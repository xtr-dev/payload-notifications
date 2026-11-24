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

    // Add collections to the Payload config
    const collections = config.collections || []
    const newCollections = [
      ...collections,
      notificationsCollection,
    ]

    // Add push subscriptions collection if web push is enabled
    if (options.webPush?.enabled) {
      const pushSubscriptionsCollection = createPushSubscriptionsCollection(options)
      newCollections.push(pushSubscriptionsCollection)
    }

    // Create push notification endpoints if web push is enabled
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
