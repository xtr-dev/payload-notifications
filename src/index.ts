import type { Config } from 'payload'
import type { NotificationsPluginOptions, NotificationsPlugin } from './types'
import { createNotificationsCollection } from './collections/notifications'
import { createPushSubscriptionsCollection } from './collections/push-subscriptions'
import { createPushNotificationEndpoints } from './endpoints/push-notifications'

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
export const notificationsPlugin: NotificationsPlugin = (options = {}) => {
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
      const pushSubscriptionsCollection = createPushSubscriptionsCollection(options.access, options)
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
  NotificationRelationship,
  NotificationCollectionConfig,
  NotificationAccess,
  NotificationChannel,
  WebPushConfig,
} from './types'

// Default export
export default notificationsPlugin