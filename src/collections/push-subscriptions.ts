import type { CollectionConfig } from 'payload'

import type { NotificationsPluginOptions } from '../types.js'

/**
 * Creates a collection to store web push subscriptions
 * Each user can have multiple subscriptions (different devices/browsers)
 */
export function createPushSubscriptionsCollection(options: NotificationsPluginOptions): CollectionConfig {
  // The collection is registered even when web push is disabled, so the
  // generated types and schema stay stable. A host that never enabled push
  // should not get a writable REST/GraphQL surface it did not ask for, so in
  // that case only admins (the same `role === 'admin'` check the
  // notifications collection uses for delete) can access it. The local API
  // bypasses access control and keeps working either way.
  const isAdmin = ({ req }: { req: any }) => Boolean(req.user?.role === 'admin')

  // With push enabled, read/update/delete are scoped to the subscription's own
  // user, so one authenticated user can't read or modify another user's
  // endpoint/keys via the REST/GraphQL API directly (bypassing the ownership
  // check in the /unsubscribe endpoint). Admins keep full access, matching the
  // convention in the notifications collection.
  const ownRecordOrAdmin = ({ req }: { req: any }) => {
    if (!req.user) {return false}
    if (req.user.role === 'admin') {return true}
    return { user: { equals: req.user.id } }
  }

  const access: CollectionConfig['access'] = options.webPush?.enabled
    ? {
        create: ({ req }: { req: any }) => Boolean(req.user),
        delete: ownRecordOrAdmin,
        read: ownRecordOrAdmin,
        update: ownRecordOrAdmin,
      }
    : {
        create: isAdmin,
        delete: isAdmin,
        read: isAdmin,
        update: isAdmin,
      }

  const config: CollectionConfig = {
    slug: 'push-subscriptions',
    access,
    admin: {
      defaultColumns: ['user', 'endpoint', 'createdAt'],
      description: 'Web push notification subscriptions for users',
      useAsTitle: 'endpoint',
      // hidden: true, // Hide from main navigation
    },
    fields: [
      {
        name: 'user',
        type: 'relationship',
        admin: {
          description: 'The user this push subscription belongs to',
        },
        label: 'User',
        relationTo: 'users',
        required: true,
      },
      {
        name: 'endpoint',
        type: 'text',
        admin: {
          description: 'Push service endpoint URL',
        },
        label: 'Endpoint',
        required: true,
        unique: true,
      },
      {
        name: 'p256dh',
        type: 'text',
        admin: {
          description: 'User agent public key for encryption',
        },
        label: 'P256DH Key',
        required: true,
      },
      {
        name: 'auth',
        type: 'text',
        admin: {
          description: 'User agent authentication secret',
        },
        label: 'Auth Secret',
        required: true,
      },
      {
        name: 'userAgent',
        type: 'text',
        admin: {
          description: 'Browser/device information',
        },
        label: 'User Agent',
      },
      {
        name: 'channels',
        type: 'select',
        admin: {
          description: 'Channels this subscription is subscribed to - leave empty for all notifications',
        },
        hasMany: true,
        label: 'Subscribed Channels',
        options: options.channels.map(channel => ({
          label: channel.name,
          value: channel.id,
        })),
      },
      {
        name: 'isActive',
        type: 'checkbox',
        admin: {
          description: 'Whether this subscription is still active',
          position: 'sidebar',
        },
        defaultValue: true,
        label: 'Active',
      },
    ],
    hooks: {
      beforeChange: [
        ({ data, req }: { data: any; req: any }) => {
          if (!req.user) {return data}
          // Non-admins always own the row they write. Create and update both
          // run this hook, so a logged-in user cannot attach their endpoint/keys
          // to another user's id (sendToRecipient would then push the victim's
          // notifications to the attacker). Admins can still assign a
          // subscription to any user, and still default to themselves when the
          // field is omitted.
          if (req.user.role !== 'admin') {
            data.user = req.user.id
          } else if (!data.user) {
            data.user = req.user.id
          }
          return data
        },
      ],
    },
    labels: {
      plural: 'Push Subscriptions',
      singular: 'Push Subscription',
    },
    timestamps: true,
  }
  return options.collectionOverrides?.pushSubscriptions ?
    options.collectionOverrides.pushSubscriptions(config) :
    config
}
