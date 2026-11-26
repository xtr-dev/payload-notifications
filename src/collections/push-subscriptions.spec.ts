import { describe, expect, test } from 'vitest'

import { createPushSubscriptionsCollection } from './push-subscriptions'

// These tests cover the owner-scoped access that applies while web push is
// enabled; with push disabled the collection is admin-only (covered in
// src/index.pushSubscriptions.spec.ts).
const pluginOptions = { channels: [], webPush: { enabled: true } } as any

function collectionAccess() {
  const collection = createPushSubscriptionsCollection(pluginOptions)
  return collection.access as {
    create: (args: any) => any
    delete: (args: any) => any
    read: (args: any) => any
    update: (args: any) => any
  }
}

function beforeChangeHook() {
  const collection = createPushSubscriptionsCollection(pluginOptions)
  const hook = collection.hooks?.beforeChange?.[0]
  if (!hook) {throw new Error('beforeChange hook was not registered')}
  return hook
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

  test('create only requires authentication; ownership is enforced in beforeChange', () => {
    const access = collectionAccess()
    expect(access.create({ req: { user: null } })).toBe(false)
    expect(access.create({ req: { user: { id: 'requesting-user' } } })).toBe(true)
  })
})

describe('push-subscriptions beforeChange ownership', () => {
  test('assigns the requesting user when the client omits user', async () => {
    const data = await beforeChangeHook()({
      data: {},
      req: { user: { id: 'requesting-user' } },
    } as any)

    expect(data.user).toBe('requesting-user')
  })

  test.each(['create', 'update'] as const)(
    '%s overwrites a non-admin attempt to set user to someone else',
    async (operation) => {
      const data = await beforeChangeHook()({
        data: { user: 'someone-else' },
        operation,
        req: { user: { id: 'requesting-user' } },
      } as any)

      expect(data.user).toBe('requesting-user')
    }
  )

  test('lets an admin assign the subscription to another user', async () => {
    const data = await beforeChangeHook()({
      data: { user: 'someone-else' },
      req: { user: { id: 'admin-user', role: 'admin' } },
    } as any)

    expect(data.user).toBe('someone-else')
  })

  test('defaults an admin create with no user to the admin themselves', async () => {
    const data = await beforeChangeHook()({
      data: {},
      req: { user: { id: 'admin-user', role: 'admin' } },
    } as any)

    expect(data.user).toBe('admin-user')
  })
})
