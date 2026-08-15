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
    expect(response.status).toBe(404)
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
