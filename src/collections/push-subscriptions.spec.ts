import { describe, expect, test } from 'vitest'
import { createPushSubscriptionsCollection } from './push-subscriptions'

const pluginOptions = { channels: [] } as any

function collectionAccess() {
  const collection = createPushSubscriptionsCollection(pluginOptions)
  return collection.access as {
    read: (args: any) => any
    create: (args: any) => any
    update: (args: any) => any
    delete: (args: any) => any
  }
}

describe('push-subscriptions collection access', () => {
  test.each(['read', 'update', 'delete'] as const)(
    '%s refuses an unauthenticated request',
    (operation) => {
      const access = collectionAccess()
      expect(access[operation]({ req: { user: null } })).toBe(false)
    }
  )

  test.each(['read', 'update', 'delete'] as const)(
    '%s scopes an authenticated non-admin request to their own subscriptions, not a blanket allow',
    (operation) => {
      const access = collectionAccess()
      const result = access[operation]({ req: { user: { id: 'requesting-user' } } })

      expect(result).not.toBe(true)
      expect(result).toEqual({ user: { equals: 'requesting-user' } })
    }
  )

  test.each(['read', 'update', 'delete'] as const)(
    '%s grants full access to an admin', (operation) => {
      const access = collectionAccess()
      const result = access[operation]({ req: { user: { id: 'admin-user', role: 'admin' } } })

      expect(result).toBe(true)
    }
  )

  test('create only requires authentication, since beforeChange assigns the requesting user', () => {
    const access = collectionAccess()
    expect(access.create({ req: { user: null } })).toBe(false)
    expect(access.create({ req: { user: { id: 'requesting-user' } } })).toBe(true)
  })
})
