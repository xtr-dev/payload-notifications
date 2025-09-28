/**
 * React Server Component exports for the notifications plugin
 * Import from '@xtr-dev/payload-notifications/rsc'
 */

export { WebPushManager } from '../utils/webPush'
export { createPushNotificationEndpoints } from '../endpoints/push-notifications'
export { createPushSubscriptionsCollection } from '../collections/push-subscriptions'

// Re-export types that are useful on the server side
export type {
  WebPushConfig,
  PushSubscription,
  NotificationsPluginOptions,
} from '../types'
