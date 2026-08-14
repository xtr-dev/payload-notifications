import type { Config } from 'payload'

import { describe, expect, it } from 'vitest'

import type { NotificationsPluginOptions } from './types'

import { notificationsPlugin } from './index'

// The plugin is a pure config transform, so these tests apply it to a bare
// config object and assert on the returned shape — no Payload instance or
// database is involved.

const bareConfig = (): Config => ({ collections: [], endpoints: [] } as unknown as Config)

const channels: NotificationsPluginOptions['channels'] = [{ id: 'a', name: 'A' }]

const vapid = {
  vapidPrivateKey: 'y',
  vapidPublicKey: 'x',
  vapidSubject: 'mailto:a@b.c',
}

const slugs = (config: Config) => (config.collections ?? []).map((c) => c.slug)

const endpointPairs = (config: Config) =>
  (config.endpoints ?? []).map((e) => ({ method: e.method, path: e.path }))

describe('webPush.enabled gate', () => {
  it('enabled: true adds the push-subscriptions collection and the three push endpoints', () => {
    const result = notificationsPlugin({
      channels,
      webPush: { enabled: true, ...vapid },
    })(bareConfig())

    expect(slugs(result)).toContain('push-subscriptions')
    expect(endpointPairs(result)).toEqual([
      { method: 'post', path: '/push-notifications/subscribe' },
      { method: 'post', path: '/push-notifications/unsubscribe' },
      { method: 'get', path: '/push-notifications/vapid-public-key' },
    ])
  })

  it('enabled: false adds neither the collection nor the endpoints', () => {
    const result = notificationsPlugin({
      channels,
      webPush: { enabled: false, ...vapid },
    })(bareConfig())

    expect(slugs(result)).not.toContain('push-subscriptions')
    expect(result.endpoints).toHaveLength(0)
  })

  it('webPush omitted adds neither the collection nor the endpoints', () => {
    const result = notificationsPlugin({ channels })(bareConfig())

    expect(slugs(result)).not.toContain('push-subscriptions')
    expect(result.endpoints).toHaveLength(0)
  })

  // The gate is `options.webPush?.enabled` truthiness, so a webPush config
  // with `enabled` left undefined — the shape a user's config most easily
  // lands in, since the VAPID keys are the required fields and `enabled` is
  // optional — counts as off. This pins that behaviour down.
  it('webPush supplied with enabled left undefined counts as disabled', () => {
    const result = notificationsPlugin({
      channels,
      webPush: { ...vapid },
    })(bareConfig())

    expect(slugs(result)).not.toContain('push-subscriptions')
    expect(result.endpoints).toHaveLength(0)
  })
})
