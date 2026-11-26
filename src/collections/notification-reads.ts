import type { CollectionConfig } from 'payload'

import { Forbidden } from 'payload'

import type { NotificationsPluginOptions } from '../types.js'

export const NOTIFICATION_READS_SLUG = 'notification-reads'

const isAdminUser = (user: any) => Boolean(user?.role === 'admin')

const relationId = (value: unknown): null | number | string => {
  if (value === null || value === undefined) { return null }
  if (typeof value === 'object' && 'id' in value) { return (value as { id: number | string }).id }
  return value as number | string
}

/**
 * Creates the collection that stores per-user read receipts for broadcasts.
 *
 * A broadcast is a single notification row shown to every user, so its own
 * isRead/readAt fields cannot say whether one particular user has read it.
 * Each row here records that one user has read one broadcast. The
 * notifications collection overlays these receipts onto isRead/readAt when a
 * signed-in user reads broadcasts, and the POST/DELETE
 * /api/notifications/:id/read endpoint creates and removes them.
 */
export function createNotificationReadsCollection(options: NotificationsPluginOptions): CollectionConfig {
  const ownOrAdmin = ({ req }: { req: any }) => {
    if (!req.user) { return false }
    if (isAdminUser(req.user)) { return true }
    return { user: { equals: req.user.id } }
  }

  const config: CollectionConfig = {
    slug: NOTIFICATION_READS_SLUG,
    access: {
      read: ownOrAdmin,
      // Non-admins may only record their own reads of broadcasts they can
      // see; the beforeChange hook below enforces that.
      create: ({ req }: { req: any }) => Boolean(req.user),
      delete: ownOrAdmin,
      update: ({ req }: { req: any }) => isAdminUser(req.user),
    },
    admin: {
      defaultColumns: ['notification', 'user', 'readAt'],
      description: 'Which user has read which broadcast. Personal notifications use their own Read flag.',
    },
    fields: [
      {
        name: 'notification',
        type: 'relationship',
        index: true,
        relationTo: 'notifications',
        required: true,
      },
      {
        name: 'user',
        type: 'relationship',
        index: true,
        relationTo: 'users',
        required: true,
      },
      {
        name: 'readAt',
        type: 'date',
        defaultValue: () => new Date().toISOString(),
        required: true,
      },
    ],
    hooks: {
      beforeChange: [
        async ({ data, operation, req }) => {
          if (operation !== 'create' || !req.user || isAdminUser(req.user)) { return data }

          // A non-admin always records a read for themselves, and only for a
          // broadcast their notifications read access lets them see.
          data.user = req.user.id
          const notificationId = relationId(data.notification)
          const notification = notificationId === null
            ? null
            : await req.payload.findByID({
                id: notificationId,
                collection: 'notifications',
                depth: 0,
                disableErrors: true,
                overrideAccess: false,
                req,
              })
          if (!notification || (notification as any).audience !== 'broadcast') {
            throw new Forbidden(req.t)
          }
          return data
        },
      ],
    },
    // One receipt per user and broadcast.
    indexes: [{ fields: ['notification', 'user'], unique: true }],
    labels: {
      plural: 'Notification Reads',
      singular: 'Notification Read',
    },
    timestamps: true,
  }

  return options.collectionOverrides?.notificationReads
    ? options.collectionOverrides.notificationReads(config)
    : config
}
