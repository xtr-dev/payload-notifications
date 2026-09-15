import type { Config } from 'payload'

import { describe, expect, it } from 'vitest'

import type { NotificationsPluginOptions, WebPushConfig } from './types'

import { notificationsPlugin } from './index'

// autoPush is an independent optional flag. webPush.enabled still registers
// the push-subscriptions collection and the three /push-notifications
// endpoints; only the notifications afterChange send hook requires both
// enabled AND autoPush. These tests pin the remaining matrix cell:
// enabled true with autoPush false or omitted — the documented setup for
// consumers who send via WebPushManager themselves. A regression that
// treated enabled as implying autoPush would attach afterChange here and
// fire a push on every create.

const bareConfig = (): Config => ({ collections: [], endpoints: [] } as unknown as Config)

const channels: NotificationsPluginOptions['channels'] = [{ id: 'a', name: 'A' }]

const vapid = {
  vapidPrivateKey: 'y',
  vapidPublicKey: 'x',
  vapidSubject: 'mailto:t@e.st',
}

const apply = (webPush: WebPushConfig) =>
  notificationsPlugin({ channels, webPush })(bareConfig())

const slugs = (config: Config) => (config.collections ?? []).map((c) => c.slug)

const endpointPairs = (config: Config) =>
  (config.endpoints ?? []).map((e) => ({ method: e.method, path: e.path }))

const pushEndpoints = [
  { method: 'post', path: '/push-notifications/subscribe' },
  { method: 'post', path: '/push-notifications/unsubscribe' },
  { method: 'get', path: '/push-notifications/vapid-public-key' },
]

const notificationsCollection = (config: Config) => {
  const collection = (config.collections ?? []).find((c) => c.slug === 'notifications')
  expect(collection, 'notifications collection is registered').toBeDefined()
  return collection!
}

const expectPushInfrastructure = (config: Config) => {
  expect(slugs(config)).toContain('push-subscriptions')
  expect(endpointPairs(config)).toEqual(expect.arrayContaining(pushEndpoints))
}

describe('webPush.autoPush is a separate gate from webPush.enabled', () => {
  it('enabled: true and autoPush: false registers infrastructure but does not attach afterChange', () => {
    const result = apply({ autoPush: false, enabled: true, ...vapid })

    expectPushInfrastructure(result)
    expect(notificationsCollection(result).hooks?.afterChange).toBeUndefined()
  })

  it('enabled: true with autoPush omitted registers infrastructure but does not attach afterChange', () => {
    const result = apply({ enabled: true, ...vapid })

    expectPushInfrastructure(result)
    expect(notificationsCollection(result).hooks?.afterChange).toBeUndefined()
  })

  it('enabled: true and autoPush: true attaches afterChange', () => {
    // Contrast for the two cells above: without this, a missing send hook
    // would still pass, and autoPush would not be shown as a real gate.
    const result = apply({ autoPush: true, enabled: true, ...vapid })

    expectPushInfrastructure(result)
    expect(notificationsCollection(result).hooks?.afterChange).toHaveLength(1)
  })
})
