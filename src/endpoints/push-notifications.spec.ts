import { describe, expect, test, vi } from 'vitest'
import { createPushNotificationEndpoints } from './push-notifications'

const pluginOptions = {
  channels: [],
  webPush: {
    enabled: true,
    vapidPublicKey: 'public-key',
    vapidPrivateKey: 'private-key',
    vapidSubject: 'mailto:test@example.com',
  },
}

function unsubscribeHandler() {
  const endpoint = createPushNotificationEndpoints(pluginOptions)
    .find(({ path }) => path === '/push-notifications/unsubscribe')

  if (!endpoint) throw new Error('Unsubscribe endpoint was not registered')
  return endpoint.handler
}

function subscribeHandler() {
  const endpoint = createPushNotificationEndpoints(pluginOptions)
    .find(({ path }) => path === '/push-notifications/subscribe')

  if (!endpoint) throw new Error('Subscribe endpoint was not registered')
  return endpoint.handler
}

const ownSubscriptionBody = {
  channels: ['general'],
  subscription: {
    endpoint: 'https://push.example.test/own-endpoint',
    keys: { auth: 'new-auth', p256dh: 'new-p256dh' },
  },
  userAgent: 'vitest',
}

const foreignSubscriptionBody = {
  channels: ['general'],
  subscription: {
    endpoint: 'https://push.example.test/other-users-endpoint',
    keys: { auth: 'attacker-auth', p256dh: 'attacker-p256dh' },
  },
  userAgent: 'vitest',
}

describe('push notification unsubscribe endpoint', () => {
  test('rejects an unauthenticated request without touching the database', async () => {
    const payload = { find: vi.fn(), update: vi.fn() }

    const response = await unsubscribeHandler()({
      user: null,
      json: vi.fn(),
      payload,
    } as any)

    expect(response.status).toBe(401)
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  test('scopes the lookup to the requesting user, so another user\'s endpoint is never matched', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [] }),
      update: vi.fn(),
    }

    const response = await unsubscribeHandler()({
      user: { id: 'requesting-user' },
      json: vi.fn().mockResolvedValue({ endpoint: 'https://push.example.test/other-users-endpoint' }),
      payload,
    } as any)

    expect(payload.find).toHaveBeenCalledWith({
      collection: 'push-subscriptions',
      where: {
        and: [
          { endpoint: { equals: 'https://push.example.test/other-users-endpoint' } },
          { user: { equals: 'requesting-user' } },
        ],
      },
      limit: 1,
    })
    expect(payload.update).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
  })

  test('deactivates a subscription that belongs to the authenticated user', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [{ id: 'owned-subscription' }] }),
      update: vi.fn().mockResolvedValue({}),
    }

    const response = await unsubscribeHandler()({
      user: { id: 'requesting-user' },
      json: vi.fn().mockResolvedValue({ endpoint: 'https://push.example.test/own-endpoint' }),
      payload,
    } as any)

    expect(payload.update).toHaveBeenCalledWith({
      collection: 'push-subscriptions',
      id: 'owned-subscription',
      data: { isActive: false },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
  })
})

describe('push notification subscribe endpoint', () => {
  test('rejects an unauthenticated request without touching the database', async () => {
    const payload = { find: vi.fn(), update: vi.fn(), create: vi.fn() }

    const response = await subscribeHandler()({
      user: null,
      json: vi.fn(),
      payload,
    } as any)

    expect(response.status).toBe(401)
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })

  test('refuses to overwrite a subscription owned by another user', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({
        docs: [{ id: 'victim-subscription', user: 'victim-user' }],
      }),
      update: vi.fn(),
      create: vi.fn(),
    }

    const response = await subscribeHandler()({
      user: { id: 'requesting-user' },
      json: vi.fn().mockResolvedValue(foreignSubscriptionBody),
      payload,
    } as any)

    expect(payload.find).toHaveBeenCalledWith({
      collection: 'push-subscriptions',
      where: {
        endpoint: { equals: 'https://push.example.test/other-users-endpoint' },
      },
      limit: 1,
      depth: 0,
    })
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'Push subscription belongs to another user',
    })
  })

  test('updates a subscription that already belongs to the authenticated user', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({
        docs: [{ id: 'owned-subscription', user: 'requesting-user' }],
      }),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn(),
    }

    const response = await subscribeHandler()({
      user: { id: 'requesting-user' },
      json: vi.fn().mockResolvedValue(ownSubscriptionBody),
      payload,
    } as any)

    expect(payload.update).toHaveBeenCalledWith({
      collection: 'push-subscriptions',
      id: 'owned-subscription',
      data: {
        user: 'requesting-user',
        p256dh: 'new-p256dh',
        auth: 'new-auth',
        userAgent: 'vitest',
        channels: ['general'],
        isActive: true,
      },
    })
    expect(payload.create).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
  })

  test('creates a subscription when the endpoint is not yet stored', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [] }),
      update: vi.fn(),
      create: vi.fn().mockResolvedValue({}),
    }

    const response = await subscribeHandler()({
      user: { id: 'requesting-user' },
      json: vi.fn().mockResolvedValue(ownSubscriptionBody),
      payload,
    } as any)

    expect(payload.create).toHaveBeenCalledWith({
      collection: 'push-subscriptions',
      data: {
        user: 'requesting-user',
        endpoint: 'https://push.example.test/own-endpoint',
        p256dh: 'new-p256dh',
        auth: 'new-auth',
        userAgent: 'vitest',
        channels: ['general'],
        isActive: true,
      },
    })
    expect(payload.update).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
  })
})
