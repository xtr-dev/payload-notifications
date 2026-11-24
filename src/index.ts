import type { Config } from 'payload'
import type { NotificationsPluginOptions, NotificationsPlugin } from './types.js'
import { createNotificationsCollection } from './collections/notifications.js'
import { createPushSubscriptionsCollection } from './collections/push-subscriptions.js'
import { createPushNotificationEndpoints } from './endpoints/push-notifications.js'

const defaultOptions: NotificationsPluginOptions = {
  channels: [
    {
      name: 'Default',
      id: 'default',
      description: 'Default channel',
    }
  ]
}

/**
 * PayloadCMS Notifications Plugin
 *
 * Adds a configurable notifications collection with support for:
 * - Title and rich text message content
 * - Recipient targeting
 * - Read/unread status tracking
 * - Configurable relationship attachments to any collection
 *
 * @param options Plugin configuration options
 * @returns Configured PayloadCMS plugin
 */
export const notificationsPlugin: NotificationsPlugin = (options = defaultOptions) => {
  return (config: Config): Config => {
    // Create the notifications collection with provided options
    const notificationsCollection = createNotificationsCollection(options)

    // The push-subscriptions collection is registered whether or not web push
    // is enabled. Registering it only when enabled made the generated types and
    // database schema depend on the VAPID keys being present: environments
    // without them (CI, `payload generate:types`, local dev) generated types
    // without `push-subscriptions`, and host code that references the
    // collection then failed to type-check. Only the endpoints and the sending
    // of pushes are gated on `webPush.enabled`.
    const collections = config.collections || []
    const newCollections = [
      ...collections,
      notificationsCollection,
      createPushSubscriptionsCollection(options),
    ]

    // The subscribe/unsubscribe/VAPID-key endpoints only exist when web push is
    // enabled, so a host without VAPID keys exposes no push API.
    const endpoints = config.endpoints || []
    const pushEndpoints = options.webPush?.enabled
      ? createPushNotificationEndpoints(options)
      : []

    return {
      ...config,
      collections: newCollections,
      endpoints: [
        ...endpoints,
        ...pushEndpoints,
      ],
    }
  }
}

// Export types for consumers
export type {
  NotificationsPluginOptions,
  NotificationChannel,
  WebPushConfig,
} from './types.js'

// Default export
export default notificationsPlugin
