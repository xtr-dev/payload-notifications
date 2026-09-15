import type { Config } from 'payload'
import { describe, expect, test } from 'vitest'
import { notificationsPlugin } from '../src/index'

describe('notificationsPlugin config transform', () => {
  test('preserves existing top-level state, collections and endpoints, and appends its own', () => {
    const existingCollection = { slug: 'existing-collection', fields: [] }
    const existingEndpoint = { path: '/existing', method: 'get', handler: async () => new Response() }

    const inputCollections = [existingCollection]
    const inputEndpoints = [existingEndpoint]

    const inputConfig = {
      collections: inputCollections,
      endpoints: inputEndpoints,
      // sentinel top-level state unrelated to what the plugin touches
      serverURL: 'https://sentinel.example.com',
      admin: { user: 'sentinel-users' },
    } as unknown as Config

    const outputConfig = notificationsPlugin({ channels: [{ id: 'default', name: 'Default' }] })(inputConfig)

    // top-level state the plugin doesn't touch is carried through unchanged
    expect(outputConfig.serverURL).toBe(inputConfig.serverURL)
    expect(outputConfig.admin).toBe(inputConfig.admin)

    // the existing collection and endpoint are retained by identity
    expect(outputConfig.collections).toContain(existingCollection)
    expect(outputConfig.endpoints).toContain(existingEndpoint)

    // notifications is appended exactly once, after the existing collection
    const notificationsSlugs = (outputConfig.collections ?? []).filter((c) => c.slug === 'notifications')
    expect(notificationsSlugs).toHaveLength(1)
    expect(outputConfig.collections?.indexOf(existingCollection)).toBeLessThan(
      outputConfig.collections?.findIndex((c) => c.slug === 'notifications') ?? -1,
    )

    // neither input array was mutated in place
    expect(inputCollections).toEqual([existingCollection])
    expect(inputEndpoints).toEqual([existingEndpoint])
    expect(outputConfig.collections).not.toBe(inputCollections)
    expect(outputConfig.endpoints).not.toBe(inputEndpoints)
  })
})
