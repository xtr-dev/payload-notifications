import type { CollectionConfig, Config, Field, SelectField } from 'payload'

import { describe, expect, it } from 'vitest'

import type { NotificationsPluginOptions, WebPushConfig } from './types.js'

import { notificationsPlugin } from './index.js'

// The plugin is a pure config transform, so these tests apply it to plain
// config objects and assert on the returned shape. No Payload instance or
// database is involved.

const notificationsOf = (config: Config): CollectionConfig => {
  const collection = (config.collections ?? []).find((c) => c.slug === 'notifications')
  expect(collection, 'notifications collection is registered').toBeDefined()
  return collection!
}

/** Returns the `channel` select field, asserting its type instead of assuming it. */
const channelFieldOf = (collection: CollectionConfig): SelectField => {
  const field = collection.fields.find((f: Field) => 'name' in f && f.name === 'channel')
  expect(field?.type).toBe('select')
  return field as SelectField
}

describe('notificationsPlugin with no arguments', () => {
  it('produces a working config from an empty host config', () => {
    // {} exercises the config.collections || [] and config.endpoints || [] fallbacks.
    const result = notificationsPlugin()({} as Config)

    expect(channelFieldOf(notificationsOf(result)).options).toEqual([{ label: 'Default', value: 'default' }])
    // Web push is off by default, so no push endpoints are registered.
    expect(result.endpoints).toEqual([])
  })

  it('does not share channel options between instances built from the shared defaults', () => {
    // Every no-argument call receives the same defaultOptions object; mutating
    // one instance's generated config must not leak into another instance.
    const first = notificationsPlugin()({} as Config)
    const second = notificationsPlugin()({} as Config)

    channelFieldOf(notificationsOf(first)).options.push({ label: 'Injected', value: 'injected' })

    expect(channelFieldOf(notificationsOf(second)).options).toEqual([{ label: 'Default', value: 'default' }])
  })
})

describe('notificationsPlugin preserves the host config', () => {
  it('keeps existing top-level state, collections and endpoints, and appends its own without mutating the input', () => {
    const existingCollection = { slug: 'existing-collection', fields: [] }
    const existingEndpoint = { path: '/existing', method: 'get', handler: async () => new Response() }
    const inputCollections = [existingCollection]
    const inputEndpoints = [existingEndpoint]
    const input = {
      admin: { user: 'sentinel-users' },
      collections: inputCollections,
      endpoints: inputEndpoints,
      serverURL: 'https://sentinel.example.com',
    } as unknown as Config

    const output = notificationsPlugin({ channels: [{ id: 'default', name: 'Default' }] })(input)

    expect(output.serverURL).toBe(input.serverURL)
    expect(output.admin).toBe(input.admin)
    expect(output.collections).toContain(existingCollection)
    expect(output.endpoints).toContain(existingEndpoint)

    const slugs = (output.collections ?? []).map((c) => c.slug)
    expect(slugs.filter((slug) => slug === 'notifications')).toHaveLength(1)
    expect(slugs.indexOf('existing-collection')).toBeLessThan(slugs.indexOf('notifications'))

    expect(inputCollections).toEqual([existingCollection])
    expect(inputEndpoints).toEqual([existingEndpoint])
    expect(output.collections).not.toBe(inputCollections)
    expect(output.endpoints).not.toBe(inputEndpoints)
  })
})

describe('webPush.autoPush gates the send hook separately from webPush.enabled', () => {
  // enabled without autoPush is the documented setup for hosts that send
  // through WebPushManager themselves; treating enabled as implying autoPush
  // would send a push on every notification create.
  const channels: NotificationsPluginOptions['channels'] = [{ id: 'a', name: 'A' }]
  const vapid = { vapidPrivateKey: 'private', vapidPublicKey: 'public', vapidSubject: 'mailto:test@example.com' }
  const apply = (webPush: WebPushConfig) =>
    notificationsPlugin({ channels, webPush })({ collections: [], endpoints: [] } as unknown as Config)

  it.each([
    ['autoPush: false', { ...vapid, autoPush: false, enabled: true }],
    ['autoPush omitted', { ...vapid, enabled: true }],
  ] as Array<[string, WebPushConfig]>)('registers the push endpoints but no send hook with %s', (_label, webPush) => {
    const result = apply(webPush)

    expect((result.endpoints ?? []).map((e) => e.path)).toContain('/push-notifications/subscribe')
    expect(notificationsOf(result).hooks?.afterChange).toBeUndefined()
  })

  it('attaches the send hook with enabled: true and autoPush: true', () => {
    expect(notificationsOf(apply({ ...vapid, autoPush: true, enabled: true })).hooks?.afterChange).toHaveLength(1)
  })
})
