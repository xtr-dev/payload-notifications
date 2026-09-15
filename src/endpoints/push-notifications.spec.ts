import { describe, expect, it } from 'vitest'
import { createPushNotificationEndpoints } from './push-notifications'
import type { NotificationsPluginOptions } from '../types'

const webPushOptions: NotificationsPluginOptions = {
  channels: [{ id: 'default', name: 'Default' }],
  webPush: {
    enabled: true,
    vapidPublicKey: 'public-key',
    vapidPrivateKey: 'private-key',
    vapidSubject: 'mailto:test@example.com',
  },
}

function findEndpoint(options: NotificationsPluginOptions, path: string) {
  const endpoint = createPushNotificationEndpoints(options).find((e) => e.path === path)
  if (!endpoint) throw new Error(`endpoint ${path} not registered`)
  return endpoint
}

function fakeRequest(body: unknown): any {
  return { json: async () => body, payload: {} }
}

describe('push-notifications /track endpoint', () => {
  it('is registered when web push is enabled', () => {
    const paths = createPushNotificationEndpoints(webPushOptions).map((e) => e.path)
    expect(paths).toContain('/push-notifications/track')
  })

  it('is not registered when web push is disabled', () => {
    const paths = createPushNotificationEndpoints({ channels: [] }).map((e) => e.path)
    expect(paths).not.toContain('/push-notifications/track')
  })

  it('accepts a tracking event and responds with success', async () => {
    const endpoint = findEndpoint(webPushOptions, '/push-notifications/track')
    const req = fakeRequest({ action: 'close', notificationId: '123', timestamp: 1700000000000 })

    const res = await endpoint.handler(req)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })

  it('rejects a body missing the action field', async () => {
    const endpoint = findEndpoint(webPushOptions, '/push-notifications/track')
    const req = fakeRequest({ notificationId: '123' })

    const res = await endpoint.handler(req)

    expect(res.status).toBe(400)
  })

  it('rejects a missing body', async () => {
    const endpoint = findEndpoint(webPushOptions, '/push-notifications/track')
    const req = fakeRequest(undefined)

    const res = await endpoint.handler(req)

    expect(res.status).toBe(400)
  })
})
