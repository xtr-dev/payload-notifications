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
          if (!body) {
            return Response.json({ error: 'Invalid request body' }, { status: 400 })
          }

          const { subscription, userAgent, channels } = body

          if (!subscription || !subscription.endpoint) {
            return Response.json({ error: 'Invalid subscription data' }, { status: 400 })
          }

          const pushManager = new WebPushManager(webPushConfig, req.payload)
          await pushManager.subscribe(
            String(req.user.id),
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
          if (!body) {
            return Response.json({ error: 'Invalid request body' }, { status: 400 })
          }

          const { endpoint } = body

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

    // Send test notification (admin only)
    {
      path: '/push-notifications/test',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        try {
          if (!req.user || req.user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 })
          }

          const body = await req.json?.()
          if (!body) {
            return Response.json({ error: 'Invalid request body' }, { status: 400 })
          }

          const { userId, title, body: messageBody, options: notificationOptions } = body

          if (!userId || !title || !messageBody) {
            return Response.json(
              { error: 'userId, title, and body are required' },
              { status: 400 }
            )
          }

          const pushManager = new WebPushManager(webPushConfig, req.payload)
          const results = await pushManager.sendToUser(
            userId,
            title,
            messageBody,
            notificationOptions
          )

          return Response.json({
            success: true,
            results,
            sent: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
          })
        } catch (error: any) {
          console.error('Test notification error:', error)
          return Response.json(
            { error: 'Failed to send test notification' },
            { status: 500 }
          )
        }
      },
    },

    // Send notification to user (authenticated users can send to themselves, admins to anyone)
    {
      path: '/push-notifications/send',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        try {
          if (!req.user) {
            return Response.json({ error: 'Authentication required' }, { status: 401 })
          }

          const body = await req.json?.()
          if (!body) {
            return Response.json({ error: 'Invalid request body' }, { status: 400 })
          }

          const { userId, title, body: messageBody, options: notificationOptions } = body

          if (!userId || !title || !messageBody) {
            return Response.json(
              { error: 'userId, title, and body are required' },
              { status: 400 }
            )
          }

          // Users can only send notifications to themselves, admins can send to anyone
          if (userId !== req.user.id && req.user.role !== 'admin') {
            return Response.json(
              { error: 'You can only send notifications to yourself' },
              { status: 403 }
            )
          }

          const pushManager = new WebPushManager(webPushConfig, req.payload)
          const results = await pushManager.sendToUser(
            userId,
            title,
            messageBody,
            notificationOptions
          )

          return Response.json({
            success: true,
            results,
            sent: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
          })
        } catch (error: any) {
          console.error('Send notification error:', error)
          return Response.json(
            { error: 'Failed to send notification' },
            { status: 500 }
          )
        }
      },
    },

    // Tracking endpoint for analytics
    {
      path: '/push-notifications/track',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        try {
          const body = await req.json?.()
          if (!body) {
            return Response.json({ error: 'Invalid request body' }, { status: 400 })
          }

          const { action, notificationId, timestamp } = body

          // Log the tracking event (you can extend this to save to database)
          console.log('Push notification tracking:', {
            action,
            notificationId,
            timestamp,
            userAgent: req.headers.get('user-agent'),
            // Note: req.ip may not be available in all environments
          })

          // You could save tracking data to a collection here
          // await req.payload.create({
          //   collection: 'notification-analytics',
          //   data: { action, notificationId, timestamp, ... }
          // })

          return Response.json({ success: true })
        } catch (error: any) {
          console.error('Tracking error:', error)
          return Response.json(
            { error: 'Failed to track notification event' },
            { status: 500 }
          )
        }
      },
    },
  ]
}
