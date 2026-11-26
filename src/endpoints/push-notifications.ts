import type { Endpoint, PayloadRequest } from 'payload'

import type { NotificationsPluginOptions } from '../types.js'

import { PushSubscriptionOwnershipError, WebPushManager } from '../utils/webPush.js'

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
      handler: async (req: PayloadRequest) => {
        try {
          if (!req.user) {
            return Response.json({ error: 'Authentication required' }, { status: 401 })
          }

          const body = await req.json?.()
          if (!body || !(typeof body === 'object' && 'subscription' in body && 'userAgent' in body && 'channels' in body)) {
            return Response.json({ error: 'Invalid request body' }, { status: 400 })
          }

          const { channels, subscription, userAgent } = body as { channels: string[], subscription: any, userAgent: string }

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
          if (error instanceof PushSubscriptionOwnershipError) {
            return Response.json({ error: error.message }, { status: 403 })
          }
          console.error('Push subscription error:', error)
          return Response.json(
            { error: 'Failed to subscribe to push notifications' },
            { status: 500 }
          )
        }
      },
      method: 'post',
      path: '/push-notifications/subscribe',
    },

    // Unsubscribe endpoint
    {
      handler: async (req: PayloadRequest) => {
        try {
          if (!req.user) {
            return Response.json({ error: 'Authentication required' }, { status: 401 })
          }

          const body = await req.json?.()
          if (!body || !(typeof body === 'object' && 'endpoint' in body)) {
            return Response.json({ error: 'Invalid request body' }, { status: 400 })
          }

          const { endpoint } = body as { endpoint: string }

          if (!endpoint) {
            return Response.json({ error: 'Endpoint is required' }, { status: 400 })
          }

          const pushManager = new WebPushManager(webPushConfig, req.payload)
          await pushManager.unsubscribe(req.user.id, endpoint)

          return Response.json({ success: true })
        } catch (error: any) {
          console.error('Push unsubscribe error:', error)
          return Response.json(
            { error: 'Failed to unsubscribe from push notifications' },
            { status: 500 }
          )
        }
      },
      method: 'post',
      path: '/push-notifications/unsubscribe',
    },

    // Get VAPID public key
    {
      handler: () => Response.json({ publicKey: webPushConfig.vapidPublicKey }),
      method: 'get',
      path: '/push-notifications/vapid-public-key',
    },

    // Track notification events reported by the service worker (e.g. notificationclose).
    // The worker's same-origin fetch carries the user's auth cookie, so anonymous
    // requests are rejected. Every field is validated before it reaches the log,
    // which keeps arbitrary strings (newlines, huge payloads) out of the server log.
    {
      handler: async (req: PayloadRequest) => {
        try {
          if (!req.user) {
            return Response.json({ error: 'Authentication required' }, { status: 401 })
          }

          let body: unknown
          try {
            body = await req.json?.()
          } catch {
            return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
          }

          const event = parseTrackEvent(body)
          if (!event) {
            return Response.json({ error: 'Invalid request body' }, { status: 400 })
          }

          const { action, notificationId, timestamp } = event
          console.log(
            `[Notifications Plugin] Push notification event: ${action}${notificationId !== undefined ? ` (notification ${notificationId})` : ''}${timestamp !== undefined ? ` at ${timestamp}` : ''} by user ${req.user.id}`
          )

          return Response.json({ success: true })
        } catch (error: any) {
          console.error('Push tracking error:', error)
          return Response.json(
            { error: 'Failed to track push notification event' },
            { status: 500 }
          )
        }
      },
      method: 'post',
      path: '/push-notifications/track',
    },
  ]
}

interface TrackEvent {
  action: string
  notificationId?: number | string
  timestamp?: number
}

const TRACK_ACTION_PATTERN = /^[a-z][\w-]{0,31}$/i
const NOTIFICATION_ID_PATTERN = /^[\w-]{1,64}$/

/**
 * Validates a /track request body: `action` is a short identifier (the
 * generated service worker sends `close`), `notificationId` is an optional
 * document id (a finite number or a short alphanumeric string), and
 * `timestamp` is an optional finite number. Returns null for anything else.
 */
function parseTrackEvent(body: unknown): null | TrackEvent {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null
  }
  const { action, notificationId, timestamp } = body as Record<string, unknown>

  if (typeof action !== 'string' || !TRACK_ACTION_PATTERN.test(action)) {
    return null
  }

  const idIsValid =
    notificationId === undefined ||
    notificationId === null ||
    (typeof notificationId === 'number' && Number.isFinite(notificationId)) ||
    (typeof notificationId === 'string' && NOTIFICATION_ID_PATTERN.test(notificationId))
  if (!idIsValid) {
    return null
  }

  const timestampIsValid =
    timestamp === undefined || timestamp === null || (typeof timestamp === 'number' && Number.isFinite(timestamp))
  if (!timestampIsValid) {
    return null
  }

  return {
    action,
    notificationId: notificationId ?? undefined,
    timestamp: timestamp ?? undefined,
  } as TrackEvent
}
