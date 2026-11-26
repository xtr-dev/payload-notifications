import type { CollectionBeforeDeleteHook, CollectionConfig, Config } from 'payload'
import type { NotificationsPluginOptions, NotificationsPlugin } from './types.js'
import { createNotificationReadsCollection, NOTIFICATION_READS_SLUG } from './collections/notification-reads.js'
import { createNotificationsCollection } from './collections/notifications.js'
import { createPushSubscriptionsCollection } from './collections/push-subscriptions.js'
import { createPushNotificationEndpoints } from './endpoints/push-notifications.js'

/**
 * Deletes a user's personal notifications, broadcast read receipts and push
 * subscriptions before the user is deleted. Runs before the delete so the
 * rows can still be found by their user id (SQL adapters set the relationship
 * to null when the user row goes away), and in the same transaction via `req`.
 */
const deleteUserNotificationData: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const owned: Array<[string, string]> = [
    ['notifications', 'recipient'],
    [NOTIFICATION_READS_SLUG, 'user'],
    ['push-subscriptions', 'user'],
  ]
  for (const [collection, field] of owned) {
    await req.payload.delete({
      collection: collection as 'notifications',
      req,
      where: { [field]: { equals: id } },
    })
  }
}

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
 * - Personal notifications (with a recipient) and broadcasts (audience: 'broadcast')
 * - Read/unread status tracking, per user for broadcasts
 * - Channel-based targeting via the `channels` option (a built-in `default` channel when called without options)
 * - Optional web push delivery via `webPush`
 * - Collection config overrides via `collectionOverrides`
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
    // The users collection gets a beforeDelete hook that removes the user's
    // notification data along with them.
    const collections = (config.collections || []).map((collection): CollectionConfig =>
      collection.slug === 'users'
        ? {
            ...collection,
            hooks: {
              ...collection.hooks,
              beforeDelete: [...(collection.hooks?.beforeDelete ?? []), deleteUserNotificationData],
            },
          }
        : collection,
    )
    const newCollections = [
      ...collections,
      notificationsCollection,
      createPushSubscriptionsCollection(options),
      createNotificationReadsCollection(options),
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
export type { NotificationAudience } from './collections/notification-audience.js'
export type {
  NotificationsPluginOptions,
  NotificationChannel,
  PushNotificationContent,
  WebPushConfig,
} from './types.js'

// Default export
export default notificationsPlugin
