import { afterEach, describe, expect, test, vi } from 'vitest'

import { WebPushManager } from '../utils/webPush.js'
import { createNotificationsCollection } from './notifications'

const collection = createNotificationsCollection({
  channels: [{ id: 'general', name: 'General' }],
})
type AccessFn = (args: { req: { user?: { id: string; role?: string } } }) => unknown
const update = collection.access?.update as AccessFn
const read = collection.access?.read as AccessFn
const create = collection.access?.create as AccessFn

function canUpdateField(name: string, user?: { id: string; role?: string }) {
  const field = collection.fields.find((candidate) => 'name' in candidate && candidate.name === name) as {
    access?: { update?: (args: { req: { user?: { id: string; role?: string } } }) => unknown }
  } | undefined
  const fieldAccess = field?.access?.update
  if (typeof fieldAccess !== 'function') {return true}
  return fieldAccess({ req: { user } })
}

describe('notifications collection update access', () => {
  test('lets authenticated users update only their own personal notifications', () => {
    // Broadcasts are shared rows, so a member must not be able to update them.
    expect(update({ req: { user: { id: 'user-1' } } })).toEqual({
      recipient: { equals: 'user-1' },
    })
  })

  test('keeps unauthenticated users out and allows administrators to update any notification', () => {
    expect(update({ req: {} })).toBe(false)
    expect(update({ req: { user: { id: 'admin-1', role: 'admin' } } })).toBe(true)
  })

  test('limits non-admin field updates to isRead and readAt', () => {
    const user = { id: 'user-1' }
    expect(canUpdateField('title', user)).toBe(false)
    expect(canUpdateField('message', user)).toBe(false)
    expect(canUpdateField('recipient', user)).toBe(false)
    expect(canUpdateField('channel', user)).toBe(false)
    expect(canUpdateField('isRead', user)).toBe(true)
    expect(canUpdateField('readAt', user)).toBe(true)
  })

  test('lets administrators update every field', () => {
    const admin = { id: 'admin-1', role: 'admin' }
    expect(canUpdateField('title', admin)).toBe(true)
    expect(canUpdateField('message', admin)).toBe(true)
    expect(canUpdateField('recipient', admin)).toBe(true)
    expect(canUpdateField('channel', admin)).toBe(true)
    expect(canUpdateField('isRead', admin)).toBe(true)
    expect(canUpdateField('readAt', admin)).toBe(true)
  })
})

describe('notifications collection read and create access', () => {
  test('members read their own notifications and broadcasts, not rows with an empty recipient', () => {
    expect(read({ req: { user: { id: 'user-1' } } })).toEqual({
      or: [
        { recipient: { equals: 'user-1' } },
        { audience: { equals: 'broadcast' } },
      ],
    })
    expect(read({ req: {} })).toBe(false)
    expect(read({ req: { user: { id: 'admin-1', role: 'admin' } } })).toBe(true)
  })

  test('only admins can create notifications', () => {
    expect(create({ req: {} })).toBe(false)
    expect(create({ req: { user: { id: 'user-1' } } })).toBe(false)
    expect(create({ req: { user: { id: 'admin-1', role: 'admin' } } })).toBe(true)
  })
})

describe('autoPush hook does not block notification creation when a push fails', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const pushHook = (findSubscriptions?: () => Promise<unknown[]>) => {
    const pushCollection = createNotificationsCollection({
      channels: [{ id: 'general', name: 'General' }],
      webPush: {
        autoPush: true,
        enabled: true,
        findSubscriptions,
        vapidPrivateKey: 'private-key',
        vapidPublicKey: 'public-key',
        vapidSubject: 'mailto:test@example.com',
      },
    })
    return pushCollection.hooks?.afterChange?.[0] as (args: unknown) => Promise<unknown>
  }

  const doc = { id: 'notification-1', channel: 'general', recipient: 'user-1', title: 'Hello' }

  test('resolves and keeps the subscription active when a send fails with a non-410/404 error', async () => {
    // sendToRecipient catches this per subscription, so the hook sees a failed result, not a throw.
    const send = vi
      .spyOn(WebPushManager.prototype, 'sendNotification')
      .mockRejectedValue(new Error('push service unreachable'))
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const payload = {
      find: vi.fn(() => Promise.resolve({ docs: [{ id: 'sub-1', auth: 'a', endpoint: 'https://push.example/1', p256dh: 'p' }] })),
      update: vi.fn(),
    }

    await expect(pushHook()({ doc, operation: 'create', req: { payload } })).resolves.toBeUndefined()
    expect(send).toHaveBeenCalledTimes(1)
    expect(payload.update).not.toHaveBeenCalled()
  })

  test('resolves when a custom findSubscriptions hook rejects, and sends nothing', async () => {
    // This failure reaches the hook's own try/catch.
    const send = vi.spyOn(WebPushManager.prototype, 'sendNotification')
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const payload = { find: vi.fn(), update: vi.fn() }

    await expect(
      pushHook(() => Promise.reject(new Error('lookup backend down')))({ doc, operation: 'create', req: { payload } }),
    ).resolves.toBeUndefined()
    expect(send).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith('[Notifications Plugin] Error sending push notification:', expect.any(Error))
  })
})
