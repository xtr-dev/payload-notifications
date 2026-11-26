import type { Access, CollectionConfig, Field, Where } from 'payload'
import type { NotificationsPluginOptions } from '../types.js'
import { WebPushManager } from '../utils/webPush.js'
import { defaultNotificationTransformer } from '../utils/richTextExtractor.js'
import {
  applyBroadcastReadState,
  deriveAudience,
  markNotificationReadEndpoints,
} from './notification-audience.js'
import { NOTIFICATION_READS_SLUG } from './notification-reads.js'

const isAdminUser = (user: any) => Boolean(user?.role === 'admin')

/**
 * Creates the notifications collection configuration
 */
export function createNotificationsCollection(options: NotificationsPluginOptions): CollectionConfig {
  const slug = 'notifications'
  const labels = {
    singular: 'Notification',
    plural: 'Notifications',
  }

  if (options.channels.length === 0) {
    throw new Error('No channels defined for notifications plugin')
  }

  const adminOnlyFieldUpdate = ({ req }: { req: any }) => isAdminUser(req.user)

  // Members read their own personal notifications and every broadcast. A
  // broadcast is identified by `audience: 'broadcast'`, never by an empty
  // recipient: the recipient relationship is set to null when the user is
  // deleted (ON DELETE SET NULL on SQL adapters), so "no recipient" would turn
  // a deleted user's personal notifications into broadcasts for everyone.
  const ownOrBroadcast: Access = ({ req }) => {
    if (!req.user) return false
    if (isAdminUser(req.user)) return true
    const own: Where = { recipient: { equals: req.user.id } }
    const broadcast: Where = { audience: { equals: 'broadcast' } }
    return { or: [own, broadcast] }
  }

  // Members update only their own personal notifications, and field access
  // limits them to isRead/readAt. A broadcast row is shared by everyone, so its
  // isRead/readAt cannot be a member's read state; members record broadcast
  // reads as notification-reads receipts (see POST /:id/read) instead.
  const ownPersonal: Access = ({ req }) => {
    if (!req.user) return false
    if (isAdminUser(req.user)) return true
    return { recipient: { equals: req.user.id } }
  }

  const access: CollectionConfig['access'] = {
    read: ownOrBroadcast,
    // Notifications are sent by the server (local API, which bypasses access)
    // or by admins. Letting any signed-in user create them would let one user
    // send messages to another from the site's own inbox.
    create: ({ req }: { req: any }) => isAdminUser(req.user),
    update: ownPersonal,
    delete: ({ req }: { req: any }) => isAdminUser(req.user),
  }

  // Build core fields
  const allFields: Field[] = [
    {
      name: 'title',
      type: 'text',
      label: 'Title',
      access: {
        update: adminOnlyFieldUpdate,
      },
      required: true,
      admin: {
        description: 'The notification title that will be displayed to users',
      },
    },
    {
      name: 'message',
      type: 'richText',
      label: 'Message',
      access: {
        update: adminOnlyFieldUpdate,
      },
      required: true,
      admin: {
        description: 'The notification message content',
      },
    },
    {
      name: 'recipient',
      type: 'relationship',
      relationTo: 'users',
      label: 'Recipient',
      access: {
        update: adminOnlyFieldUpdate,
      },
      required: false,
      admin: {
        description: 'The user who should receive this notification (optional if using custom recipient fields)',
      },
    },
    {
      name: 'audience',
      type: 'select',
      label: 'Audience',
      access: {
        update: adminOnlyFieldUpdate,
      },
      index: true,
      admin: {
        description: 'Who can see this notification. Left empty on create, it becomes "Broadcast" when there is no recipient and "Recipient only" otherwise.',
        position: 'sidebar',
      },
      options: [
        { label: 'Recipient only', value: 'user' },
        { label: 'Broadcast to everyone', value: 'broadcast' },
      ],
    },
    {
      name: 'channel',
      type: 'select',
      label: 'Channel',
      options: options.channels.map(channel => ({
        label: channel.name,
        value: channel.id,
      })),
      access: {
        update: adminOnlyFieldUpdate,
      },
      required: false,
      admin: {
        description: 'The notification channel - only subscribers to this channel will receive the notification',
        position: 'sidebar',
      },
    },
    {
      name: 'isRead',
      type: 'checkbox',
      label: 'Read',
      defaultValue: false,
      admin: {
        description: 'Whether the recipient has read this notification. For broadcasts, reads return the requesting user\'s own read state.',
        position: 'sidebar',
      },
    },
    {
      name: 'readAt',
      type: 'date',
      label: 'Read At',
      admin: {
        description: 'When this notification was marked as read',
        position: 'sidebar',
        condition: (_: any, siblingData: any) => siblingData?.isRead,
      },
    },
  ]

  const config: CollectionConfig = {
    slug,
    labels,
    admin: {
      useAsTitle: 'title',
      defaultColumns: ['title', 'audience', 'recipient', 'isRead', 'createdAt'],
      description: 'Manage user notifications and messaging',
    },
    fields: allFields,
    access,
    endpoints: markNotificationReadEndpoints,
    hooks: {
      afterDelete: [
        async ({ id, req }) => {
          await req.payload.delete({
            collection: NOTIFICATION_READS_SLUG,
            req,
            where: { notification: { equals: id } },
          })
        },
      ],
      afterOperation: [applyBroadcastReadState],
      beforeValidate: [deriveAudience],
    },
    timestamps: true,
  }

  // Add hooks for automatic push notifications if web push is enabled
  if (options.webPush?.enabled && options.webPush.autoPush) {
    config.hooks = {
      ...config.hooks,
      afterChange: [
        async ({ doc, operation, req }) => {
          // Only send push notifications for new notifications
          if (operation !== 'create') return

          try {
            const webPushConfig = options.webPush!
            const pushManager = new WebPushManager(webPushConfig, req.payload)

            // Transform notification content using custom transformer or default
            const transformer = webPushConfig.transformNotification || defaultNotificationTransformer
            const pushContent = transformer(doc)

            console.log('[Notifications Plugin] Sending push notification for notification:', doc.id)
            console.log('[Notifications Plugin] Push content:', pushContent)

            let results: Array<{ success: boolean; error?: any }> = []

            // Check if custom findSubscriptions hook is provided
            if (webPushConfig.findSubscriptions) {
              // Use custom hook to find subscriptions
              console.log('[Notifications Plugin] Using custom findSubscriptions hook')
              const subscriptions = await webPushConfig.findSubscriptions(doc, req.payload)

              if (!subscriptions || subscriptions.length === 0) {
                console.log('[Notifications Plugin] No subscriptions found via custom hook')
                return
              }

              // Send notifications directly to the found subscriptions
              const notificationPayload = JSON.stringify({
                title: pushContent.title,
                body: pushContent.body,
                icon: pushContent.icon || '/icon-192x192.png',
                badge: pushContent.badge || '/badge-72x72.png',
                image: pushContent.image,
                data: pushContent.data,
                actions: pushContent.actions,
                tag: pushContent.tag,
                requireInteraction: pushContent.requireInteraction || false,
                timestamp: Date.now(),
              })

              results = await Promise.allSettled(
                subscriptions.map(async (sub: any) => {
                  try {
                    const pushSub = {
                      endpoint: sub.endpoint,
                      keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                      },
                    }
                    await pushManager.sendNotification(pushSub, notificationPayload)
                    return { success: true }
                  } catch (error: any) {
                    // Handle expired/invalid subscriptions
                    if (error.statusCode === 410 || error.statusCode === 404) {
                      await req.payload.update({
                        collection: 'push-subscriptions',
                        id: sub.id,
                        data: { isActive: false },
                      })
                    }
                    return { success: false, error }
                  }
                })
              ).then(results =>
                results.map((result) =>
                  result.status === 'fulfilled'
                    ? result.value
                    : { success: false, error: result.reason }
                )
              )
            } else {
              // Use default behavior - send to recipient user (if recipient is provided)
              if (!doc.recipient) {
                console.warn('[Notifications Plugin] No recipient found and no findSubscriptions hook provided - skipping push notification')
                return
              }

              let recipientId: string|number

              if (typeof doc.recipient === 'string' || typeof doc.recipient === 'number') {
                recipientId = doc.recipient
              } else if (doc.recipient?.id) {
                recipientId = doc.recipient.id
              } else {
                console.warn('[Notifications Plugin] No valid recipient found for push notification')
                return
              }

              console.log('[Notifications Plugin] Using default user-based recipient logic for:', recipientId)

              // Send push notification to the recipient user
              results = await pushManager.sendToRecipient(
                recipientId,
                pushContent.title,
                pushContent.body,
                {
                  icon: pushContent.icon,
                  badge: pushContent.badge,
                  image: pushContent.image,
                  data: pushContent.data,
                  actions: pushContent.actions,
                  tag: pushContent.tag,
                  requireInteraction: pushContent.requireInteraction,
                  channel: doc.channel,
                  recipientType: 'user',
                }
              )
            }

            const successful = results.filter(r => r.success).length
            const failed = results.filter(r => !r.success).length

            console.log(`[Notifications Plugin] Push notification results: ${successful} sent, ${failed} failed`)

            if (failed > 0) {
              console.warn('[Notifications Plugin] Some push notifications failed:',
                results.filter(r => !r.success).map(r => r.error)
              )
            }

          } catch (error) {
            console.error('[Notifications Plugin] Error sending push notification:', error)
            // Don't throw error - we don't want to prevent notification creation
          }
        },
      ],
    }
  }

  return options.collectionOverrides?.notifications ?
    options.collectionOverrides.notifications(config) :
    config
}
