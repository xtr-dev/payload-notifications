import type { CollectionConfig } from 'payload'
import type { NotificationAccess, NotificationsPluginOptions } from '../types'

/**
 * Creates a collection to store web push subscriptions
 * Each user can have multiple subscriptions (different devices/browsers)
 */
export function createPushSubscriptionsCollection(access: NotificationAccess = {}, options: NotificationsPluginOptions = {}): CollectionConfig {
  const defaultAccess: NotificationAccess = {
    read: ({ req }: { req: any }) => Boolean(req.user),
    create: ({ req }: { req: any }) => Boolean(req.user),
    update: ({ req }: { req: any }) => Boolean(req.user),
    delete: ({ req }: { req: any }) => Boolean(req.user),
  }

  return {
    slug: 'push-subscriptions',
    labels: {
      singular: 'Push Subscription',
      plural: 'Push Subscriptions',
    },
    admin: {
      useAsTitle: 'endpoint',
      defaultColumns: ['user', 'endpoint', 'createdAt'],
      description: 'Web push notification subscriptions for users',
      // hidden: true, // Hide from main navigation
    },
    fields: [
      {
        name: 'user',
        type: 'relationship',
        relationTo: 'users',
        label: 'User',
        required: true,
        admin: {
          description: 'The user this push subscription belongs to',
        },
      },
      {
        name: 'endpoint',
        type: 'text',
        label: 'Endpoint',
        required: true,
        unique: true,
        admin: {
          description: 'Push service endpoint URL',
        },
      },
      {
        name: 'p256dh',
        type: 'text',
        label: 'P256DH Key',
        required: true,
        admin: {
          description: 'User agent public key for encryption',
        },
      },
      {
        name: 'auth',
        type: 'text',
        label: 'Auth Secret',
        required: true,
        admin: {
          description: 'User agent authentication secret',
        },
      },
      {
        name: 'userAgent',
        type: 'text',
        label: 'User Agent',
        admin: {
          description: 'Browser/device information',
        },
      },
      {
        name: 'channels',
        type: 'select',
        label: 'Subscribed Channels',
        options: options.channels && options.channels.length > 0 
          ? options.channels.map(channel => ({
              label: channel.name,
              value: channel.id,
            }))
          : [{ label: 'All Notifications', value: 'all' }],
        hasMany: true,
        defaultValue: options.channels && options.channels.length > 0 
          ? options.channels.filter(channel => channel.defaultEnabled !== false).map(channel => channel.id)
          : ['all'],
        admin: {
          description: 'Channels this subscription is subscribed to - leave empty for all notifications',
        },
      },
      {
        name: 'isActive',
        type: 'checkbox',
        label: 'Active',
        defaultValue: true,
        admin: {
          description: 'Whether this subscription is still active',
          position: 'sidebar',
        },
      },
    ],
    access: {
      read: access.read || defaultAccess.read!,
      create: access.create || defaultAccess.create!,
      update: access.update || defaultAccess.update!,
      delete: access.delete || defaultAccess.delete!,
    },
    timestamps: true,
    hooks: {
      beforeChange: [
        ({ req, data }: { req: any; data: any }) => {
          // For user-based subscriptions, default to current user
          if (req.user && !data.user) {
            data.user = req.user.id
          }
          return data
        },
      ],
    },
  }
}
