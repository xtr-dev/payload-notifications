import type { Endpoint, PayloadRequest } from 'payload'
import { WebPushManager } from '../utils/webPush'
import type { NotificationsPluginOptions } from '../types'

/**
 * Create push notification API endpoints
 */
export function createPushNotificationEndpoints(options: NotificationsPluginOptions): Endpoint[] {
  if (!options.webPush?.enabled) {
    return []
  }

  const webPushConfig = options.webPush

  return [
    // Subscribe endpoint
    {
      path: '/push-notifications/subscribe',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        try {
          if (!req.user) {
            return Response.json({ error: 'Authentication required' }, { status: 401 })
          }

          const body = await req.json?.()
          if (!body || !(typeof body === 'object' && 'subscription' in body && 'userAgent' in body && 'channels' in body)) {
            return Response.json({ error: 'Invalid request body' }, { status: 400 })
          }

          const { subscription, userAgent, channels } = body as { subscription: any, userAgent: string, channels: string[] }

          if (!subscription || !subscription.endpoint) {
            return Response.json({ error: 'Invalid subscription data' }, { status: 400 })
          }

          const pushManager = new WebPushManager(webPushConfig, req.payload)
          await pushManager.subscribe(
            req.user.id,
            subscription,
            userAgent,
            channels
          )

          return Response.json({ success: true })
        } catch (error: any) {
          console.error('Push subscription error:', error)
          return Response.json(
            { error: 'Failed to subscribe to push notifications' },
            { status: 500 }
          )
        }
      },
    },

    // Unsubscribe endpoint
    {
      path: '/push-notifications/unsubscribe',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        try {
          const body = await req.json?.()
          if (!body || !(typeof body === 'object' && 'endpoint' in body)) {
            return Response.json({ error: 'Invalid request body' }, { status: 400 })
          }

          const { endpoint } = body as { endpoint: string }

          if (!endpoint) {
            return Response.json({ error: 'Endpoint is required' }, { status: 400 })
          }

          const pushManager = new WebPushManager(webPushConfig, req.payload)
          await pushManager.unsubscribe(endpoint)

          return Response.json({ success: true })
        } catch (error: any) {
          console.error('Push unsubscribe error:', error)
          return Response.json(
            { error: 'Failed to unsubscribe from push notifications' },
            { status: 500 }
          )
        }
      },
    },

    // Get VAPID public key
    {
      path: '/push-notifications/vapid-public-key',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          return Response.json({
            publicKey: webPushConfig.vapidPublicKey,
          })
        } catch (error: any) {
          console.error('VAPID key error:', error)
          return Response.json(
            { error: 'Failed to get VAPID public key' },
            { status: 500 }
          )
        }
      },
    },
  ]
}
