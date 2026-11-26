/**
 * React Server Component exports for the notifications plugin
 * Import from '@xtr-dev/payload-notifications/rsc'
 */

export { createPushSubscriptionsCollection } from '../collections/push-subscriptions.js'
export { createPushNotificationEndpoints } from '../endpoints/push-notifications.js'
// Re-export types that are useful on the server side
export type {
  NotificationsPluginOptions,
  PushSubscription,
  WebPushConfig,
} from '../types.js'

export { WebPushManager } from '../utils/webPush.js'
