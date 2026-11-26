import { afterEach, describe, expect, test, vi } from 'vitest'

import { createNotificationsCollection } from '../collections/notifications'
import { defaultNotificationTransformer } from './richTextExtractor'
import { WebPushManager } from './webPush'

const notification = {
  id: 42,
  title: 'Booking confirmed',
  message: [{ type: 'paragraph', children: [{ text: 'See you on Friday.' }] }],
  createdAt: '2026-01-01T00:00:00.000Z',
  recipient: 7,
}

describe('defaultNotificationTransformer', () => {
  test('links to / by default instead of the admin panel', () => {
    const content = defaultNotificationTransformer(notification)
    expect(content.data.url).toBe('/')
    expect(JSON.stringify(content)).not.toContain('/admin')
  })

  test('uses a configured url, as a string or a function of the notification', () => {
    expect(defaultNotificationTransformer(notification, { url: '/inbox' }).data.url).toBe('/inbox')
    expect(
      defaultNotificationTransformer(notification, { url: (doc) => `/inbox/${doc.id}` }).data.url,
    ).toBe('/inbox/42')
  })

  test('references no icon, badge or action images the package does not ship', () => {
    const content = defaultNotificationTransformer(notification)
    expect(content.icon).toBeUndefined()
    expect(content.badge).toBeUndefined()
    expect(content.actions).toBeUndefined()
  })

  test('sets the id and trackClose data the service worker needs for close tracking', () => {
    const content = defaultNotificationTransformer(notification)
    expect(content.data).toMatchObject({ id: 42, notificationId: 42, trackClose: true })
    expect(content.body).toBe('See you on Friday.')
  })
})

describe('autoPush payload with the default transformer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const webPush = {
    enabled: true,
    autoPush: true,
    vapidPublicKey: 'public-key',
    vapidPrivateKey: 'private-key',
    vapidSubject: 'mailto:test@example.com',
  }

  const subscription = { id: 1, endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' }

  const runAfterChange = async (
    options: Partial<typeof webPush> & {
      findSubscriptions?: () => Promise<unknown[]>
      notificationUrl?: string
    },
  ) => {
    const sent: string[] = []
    vi.spyOn(WebPushManager.prototype, 'sendNotification').mockImplementation(async (_sub, body) => {
      sent.push(body)
      return {} as never
    })
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const collection = createNotificationsCollection({
      channels: [{ id: 'general', name: 'General' }],
      webPush: { ...webPush, ...options },
    })
    const hook = collection.hooks?.afterChange?.[0] as (args: unknown) => Promise<unknown>
    const payload = {
      find: vi.fn(async () => ({ docs: [subscription] })),
      update: vi.fn(),
    }
    await hook({ doc: notification, operation: 'create', req: { payload } })
    expect(sent).toHaveLength(1)
    return JSON.parse(sent[0])
  }

  test('sendToRecipient adds no icon or badge fallback and honours notificationUrl', async () => {
    const pushed = await runAfterChange({ notificationUrl: '/inbox' })
    expect(pushed.icon).toBeUndefined()
    expect(pushed.badge).toBeUndefined()
    expect(pushed.data).toMatchObject({ id: 42, trackClose: true, url: '/inbox' })
  })

  test('the findSubscriptions path adds no icon or badge fallback either', async () => {
    const pushed = await runAfterChange({ findSubscriptions: async () => [subscription] })
    expect(pushed.icon).toBeUndefined()
    expect(pushed.badge).toBeUndefined()
    expect(pushed.data.url).toBe('/')
  })
})
