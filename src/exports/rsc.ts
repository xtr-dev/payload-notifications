/**
 * React Server Component exports for the notifications plugin
 * Import from '@xtr-dev/payload-notifications/rsc'
 */

export { WebPushManager } from '../utils/webPush.js'
export { createPushNotificationEndpoints } from '../endpoints/push-notifications.js'
export { createPushSubscriptionsCollection } from '../collections/push-subscriptions.js'

// Re-export types that are useful on the server side
export type {
  WebPushConfig,
  PushSubscription,
  NotificationsPluginOptions,
} from '../types.js'
