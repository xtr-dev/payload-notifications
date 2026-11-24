import type { Config } from 'payload'

import { describe, expect, it } from 'vitest'

import type { NotificationsPluginOptions, WebPushConfig } from './types.js'

import { notificationsPlugin } from './index.js'

// The push-subscriptions collection must exist regardless of webPush.enabled,
// so the generated types and database schema do not depend on whether VAPID
// keys are configured in the environment that runs `payload generate:types`.
// Only the push endpoints (and sending) are gated on webPush.enabled.

const bareConfig = (): Config => ({ collections: [], endpoints: [] }) as unknown as Config

const channels: NotificationsPluginOptions['channels'] = [{ id: 'a', name: 'A' }]

const vapid = {
  vapidPrivateKey: 'private',
  vapidPublicKey: 'public',
  vapidSubject: 'mailto:test@example.com',
}

const apply = (webPush?: WebPushConfig) =>
  notificationsPlugin({ channels, webPush })(bareConfig())

const slugs = (config: Config) => (config.collections ?? []).map((c) => c.slug)

const endpointPaths = (config: Config) => (config.endpoints ?? []).map((e) => e.path)

describe('push-subscriptions collection registration', () => {
  it.each([
    ['webPush omitted', undefined],
    ['webPush.enabled: false', { ...vapid, enabled: false }],
    ['webPush.enabled left undefined', { ...vapid }],
    ['webPush.enabled: true', { ...vapid, enabled: true }],
  ] as Array<[string, undefined | WebPushConfig]>)(
    'is registered with %s',
    (_label, webPush) => {
      expect(slugs(apply(webPush))).toEqual(['notifications', 'push-subscriptions'])
    },
  )

  it('is registered by the no-argument plugin call', () => {
    const result = notificationsPlugin()(bareConfig())
    expect(slugs(result)).toEqual(['notifications', 'push-subscriptions'])
  })

  it('still applies the pushSubscriptions collection override when web push is disabled', () => {
    const result = notificationsPlugin({
      channels,
      collectionOverrides: {
        pushSubscriptions: (collection) => ({ ...collection, labels: { plural: 'Devices', singular: 'Device' } }),
      },
    })(bareConfig())

    const collection = (result.collections ?? []).find((c) => c.slug === 'push-subscriptions')
    expect(collection?.labels).toEqual({ plural: 'Devices', singular: 'Device' })
  })
})

describe('push endpoints stay gated on webPush.enabled', () => {
  it.each([
    ['webPush omitted', undefined],
    ['webPush.enabled: false', { ...vapid, enabled: false }],
    ['webPush.enabled left undefined', { ...vapid }],
  ] as Array<[string, undefined | WebPushConfig]>)('none are registered with %s', (_label, webPush) => {
    expect(endpointPaths(apply(webPush))).toEqual([])
  })

  it('are registered with webPush.enabled: true', () => {
    expect(endpointPaths(apply({ ...vapid, enabled: true }))).toEqual(
      expect.arrayContaining([
        '/push-notifications/subscribe',
        '/push-notifications/unsubscribe',
        '/push-notifications/vapid-public-key',
      ]),
    )
  })

  it('does not attach the auto-push hook when web push is disabled, even with autoPush: true', () => {
    const result = apply({ ...vapid, autoPush: true, enabled: false })
    const notifications = (result.collections ?? []).find((c) => c.slug === 'notifications')
    expect(notifications?.hooks?.afterChange).toBeUndefined()
  })
})
