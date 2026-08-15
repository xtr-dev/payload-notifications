import type { CollectionConfig, Config, Field, SelectField } from 'payload'
import { describe, expect, it } from 'vitest'
import { notificationsPlugin } from './index'

/**
 * Finds the `channel` select field on a built notifications collection.
 * Narrowing to SelectField is asserted, not assumed, so a schema change
 * that renames or retypes the field fails here rather than deeper in a test.
 */
function getChannelField(collection: CollectionConfig): SelectField {
  const field = collection.fields.find(
    (f: Field): f is SelectField => 'name' in f && f.name === 'channel',
  )
  expect(field, 'notifications collection should have a channel field').toBeDefined()
  expect(field!.type).toBe('select')
  return field!
}

describe('notificationsPlugin with no arguments', () => {
  it('produces a working config from defaults', () => {
    const result = notificationsPlugin()({} as Config)

    // The {} input exercises the config.collections || [] and
    // config.endpoints || [] fallbacks: both keys are absent.
    expect(result.collections).toHaveLength(1)
    const collection = result.collections![0]
    expect(collection.slug).toBe('notifications')

    // The default channel list is turned into select options at
    // src/collections/notifications.ts (options.channels.map).
    const channelField = getChannelField(collection)
    expect(channelField.options).toEqual([{ label: 'Default', value: 'default' }])

    // Web push defaults to off, so neither its collection nor its
    // endpoints may appear: the gate turns everything on or nothing on.
    expect(result.collections!.some((c) => c.slug === 'push-subscriptions')).toBe(false)
    expect(result.endpoints).toEqual([])
  })

  it('does not leak mutations of one instance into another', () => {
    // Both no-argument calls receive the very same defaultOptions object
    // (src/index.ts). The channel field is built via options.channels.map
    // (src/collections/notifications.ts), a fresh array each call today -
    // pushing onto one instance's options must not affect the other's,
    // which would happen if a future change aliased that array instead of
    // mapping it.
    const first = notificationsPlugin()({} as Config)
    const second = notificationsPlugin()({} as Config)

    const firstOptions = getChannelField(first.collections![0]).options
    firstOptions.push({ label: 'Injected', value: 'injected' })

    expect(getChannelField(second.collections![0]).options).toEqual([
      { label: 'Default', value: 'default' },
    ])
  })
})
