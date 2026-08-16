import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NotificationsPluginOptions } from '../types'

import { createNotificationsCollection } from './notifications'

const sendNotification = vi.fn()
const setVapidDetails = vi.fn()

vi.mock('web-push', () => ({
  default: {
    sendNotification: (...args: unknown[]) => sendNotification(...args),
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
  },
}))

const vapid = {
  vapidPrivateKey: 'private-key',
  vapidPublicKey: 'public-key',
  vapidSubject: 'mailto:test@example.com',
}

const channels: NotificationsPluginOptions['channels'] = [{ id: 'default', name: 'Default' }]

function afterChangeHook(options: NotificationsPluginOptions) {
  const collection = createNotificationsCollection(options)
  const hook = collection.hooks?.afterChange?.[0]
  if (!hook) {throw new Error('afterChange hook was not registered')}
  return hook
}

const doc = { id: 'notification-1', channel: 'default', recipient: 'user-1', title: 'Hello' }

describe('afterChange push hook does not block notification creation on push failure', () => {
  beforeEach(() => {
    sendNotification.mockReset()
    setVapidDetails.mockReset()
  })

  it('resolves (does not reject the create) when the default recipient send rejects with a non-subscription error', async () => {
    sendNotification.mockRejectedValue(new Error('push service unreachable'))
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ id: 'sub-1', auth: 'a1', endpoint: 'https://push.example.test/1', p256dh: 'p1' }] }),
      update: vi.fn(),
    }
    const hook = afterChangeHook({
      channels,
      webPush: { autoPush: true, enabled: true, ...vapid },
    })

    await expect(hook({ doc, operation: 'create', req: { payload } } as any)).resolves.toBeUndefined()
    // A generic send failure is not a 410/404 "subscription gone" signal, so the
    // subscription itself must be left alone - only the send is reported as failed.
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('resolves (does not reject the create) when a custom findSubscriptions hook rejects', async () => {
    const findSubscriptions = vi.fn().mockRejectedValue(new Error('lookup backend down'))
    const payload = { find: vi.fn(), update: vi.fn() }
    const hook = afterChangeHook({
      channels,
      webPush: { autoPush: true, enabled: true, findSubscriptions, ...vapid },
    })

    await expect(hook({ doc, operation: 'create', req: { payload } } as any)).resolves.toBeUndefined()
    expect(sendNotification).not.toHaveBeenCalled()
  })
})
