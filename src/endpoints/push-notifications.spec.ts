import { describe, expect, test, vi } from 'vitest'

import { createPushNotificationEndpoints } from './push-notifications'

const pluginOptions = {
  channels: [],
  webPush: {
    enabled: true,
    vapidPrivateKey: 'private-key',
    vapidPublicKey: 'public-key',
    vapidSubject: 'mailto:test@example.com',
  },
}

function unsubscribeHandler() {
  const endpoint = createPushNotificationEndpoints(pluginOptions)
    .find(({ path }) => path === '/push-notifications/unsubscribe')

  if (!endpoint) {throw new Error('Unsubscribe endpoint was not registered')}
  return endpoint.handler
}

function subscribeHandler() {
  const endpoint = createPushNotificationEndpoints(pluginOptions)
    .find(({ path }) => path === '/push-notifications/subscribe')

  if (!endpoint) {throw new Error('Subscribe endpoint was not registered')}
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
      json: vi.fn(),
      payload,
      user: null,
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
      json: vi.fn().mockResolvedValue({ endpoint: 'https://push.example.test/other-users-endpoint' }),
      payload,
      user: { id: 'requesting-user' },
    } as any)

    expect(payload.find).toHaveBeenCalledWith({
      collection: 'push-subscriptions',
      limit: 1,
      where: {
        and: [
          { endpoint: { equals: 'https://push.example.test/other-users-endpoint' } },
          { user: { equals: 'requesting-user' } },
        ],
      },
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
      json: vi.fn().mockResolvedValue({ endpoint: 'https://push.example.test/own-endpoint' }),
      payload,
      user: { id: 'requesting-user' },
    } as any)

    expect(payload.update).toHaveBeenCalledWith({
      id: 'owned-subscription',
      collection: 'push-subscriptions',
      data: { isActive: false },
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
  })
})

describe('push notification subscribe endpoint', () => {
  test('rejects an unauthenticated request without touching the database', async () => {
    const payload = { create: vi.fn(), find: vi.fn(), update: vi.fn() }

    const response = await subscribeHandler()({
      json: vi.fn(),
      payload,
      user: null,
    } as any)

    expect(response.status).toBe(401)
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })

  test('refuses to overwrite a subscription owned by another user', async () => {
    const payload = {
      create: vi.fn(),
      find: vi.fn().mockResolvedValue({
        docs: [{ id: 'victim-subscription', user: 'victim-user' }],
      }),
      update: vi.fn(),
    }

    const response = await subscribeHandler()({
      json: vi.fn().mockResolvedValue(foreignSubscriptionBody),
      payload,
      user: { id: 'requesting-user' },
    } as any)

    expect(payload.find).toHaveBeenCalledWith({
      collection: 'push-subscriptions',
      depth: 0,
      limit: 1,
      where: {
        endpoint: { equals: 'https://push.example.test/other-users-endpoint' },
      },
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
      create: vi.fn(),
      find: vi.fn().mockResolvedValue({
        docs: [{ id: 'owned-subscription', user: 'requesting-user' }],
      }),
      update: vi.fn().mockResolvedValue({}),
    }

    const response = await subscribeHandler()({
      json: vi.fn().mockResolvedValue(ownSubscriptionBody),
      payload,
      user: { id: 'requesting-user' },
    } as any)

    expect(payload.update).toHaveBeenCalledWith({
      id: 'owned-subscription',
      collection: 'push-subscriptions',
      data: {
        auth: 'new-auth',
        channels: ['general'],
        isActive: true,
        p256dh: 'new-p256dh',
        user: 'requesting-user',
        userAgent: 'vitest',
      },
    })
    expect(payload.create).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
  })

  test('creates a subscription when the endpoint is not yet stored', async () => {
    const payload = {
      create: vi.fn().mockResolvedValue({}),
      find: vi.fn().mockResolvedValue({ docs: [] }),
      update: vi.fn(),
    }

    const response = await subscribeHandler()({
      json: vi.fn().mockResolvedValue(ownSubscriptionBody),
      payload,
      user: { id: 'requesting-user' },
    } as any)

    expect(payload.create).toHaveBeenCalledWith({
      collection: 'push-subscriptions',
      data: {
        auth: 'new-auth',
        channels: ['general'],
        endpoint: 'https://push.example.test/own-endpoint',
        isActive: true,
        p256dh: 'new-p256dh',
        user: 'requesting-user',
        userAgent: 'vitest',
      },
    })
    expect(payload.update).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
  })
})

function trackHandler() {
  const endpoint = createPushNotificationEndpoints(pluginOptions)
    .find(({ path }) => path === '/push-notifications/track')

  if (!endpoint) {throw new Error('Track endpoint was not registered')}
  return endpoint.handler
}

function trackRequest(body: unknown, user: unknown = { id: 'user-1' }): any {
  return { json: () => Promise.resolve(body), payload: {}, user }
}

describe('push notification track endpoint', () => {
  test('is registered when web push is enabled', () => {
    const paths = createPushNotificationEndpoints(pluginOptions).map(({ path }) => path)
    expect(paths).toContain('/push-notifications/track')
  })

  test('is not registered when web push is disabled', () => {
    const paths = createPushNotificationEndpoints({ channels: [] }).map(({ path }) => path)
    expect(paths).not.toContain('/push-notifications/track')
  })

  test('accepts a tracking event and responds with success', async () => {
    const response = await trackHandler()(
      trackRequest({ action: 'close', notificationId: '123', timestamp: 1700000000000 }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
  })

  test('rejects a body missing the action field', async () => {
    const response = await trackHandler()(trackRequest({ notificationId: '123' }))

    expect(response.status).toBe(400)
  })

  test('rejects a missing body', async () => {
    const response = await trackHandler()(trackRequest(undefined))

    expect(response.status).toBe(400)
  })

  test('rejects an unauthenticated request', async () => {
    const response = await trackHandler()(trackRequest({ action: 'close', notificationId: '123' }, null))

    expect(response.status).toBe(401)
  })

  test('answers malformed JSON with 400 instead of 500', async () => {
    const request = { json: () => Promise.resolve().then(() => JSON.parse('{not json')), payload: {}, user: { id: 'user-1' } }
    const response = await trackHandler()(request as any)

    expect(response.status).toBe(400)
  })

  test.each([
    ['a non-string action', { action: 42 }],
    ['an action with a newline', { action: 'close\nFAKE LOG LINE' }],
    ['an overlong action', { action: 'a'.repeat(33) }],
    ['a notificationId with a newline', { action: 'close', notificationId: '1\nFAKE' }],
    ['an object notificationId', { action: 'close', notificationId: { $ne: null } }],
    ['a string timestamp', { action: 'close', timestamp: 'yesterday' }],
    ['an array body', [{ action: 'close' }]],
  ])('rejects %s', async (_label, body) => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const response = await trackHandler()(trackRequest(body))

    expect(response.status).toBe(400)
    expect(log).not.toHaveBeenCalled()
    log.mockRestore()
  })

  test('accepts a numeric notificationId and logs the event', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const response = await trackHandler()(trackRequest({ action: 'close', notificationId: 7, timestamp: 1 }))

    expect(response.status).toBe(200)
    expect(log).toHaveBeenCalledWith(expect.stringContaining('close (notification 7) at 1'))
    log.mockRestore()
  })
})
