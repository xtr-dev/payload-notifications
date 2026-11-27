import type { Access, CollectionConfig, Field, Where } from 'payload'

import type { NotificationsPluginOptions } from '../types.js'

import { defaultNotificationTransformer } from '../utils/richTextExtractor.js'
import { WebPushManager } from '../utils/webPush.js'
import {
  applyBroadcastReadState,
  deriveAudience,
  markNotificationReadEndpoints,
} from './notification-audience.js'
import { NOTIFICATION_READS_SLUG } from './notification-reads.js'
import { restrictRecipientUpdates } from './recipient-field-access.js'

const isAdminUser = (user: any) => Boolean(user?.role === 'admin')

/**
 * Creates the notifications collection configuration
 */
export function createNotificationsCollection(options: NotificationsPluginOptions): CollectionConfig {
  const slug = 'notifications'
  const labels = {
    plural: 'Notifications',
    singular: 'Notification',
  }

  if (options.channels.length === 0) {
    throw new Error('No channels defined for notifications plugin')
  }

  // Members read their own personal notifications and every broadcast. A
  // broadcast is identified by `audience: 'broadcast'`, never by an empty
  // recipient: the recipient relationship is set to null when the user is
  // deleted (ON DELETE SET NULL on SQL adapters), so "no recipient" would turn
  // a deleted user's personal notifications into broadcasts for everyone.
  const ownOrBroadcast: Access = ({ req }) => {
    if (!req.user) {return false}
    if (isAdminUser(req.user)) {return true}
    const own: Where = { recipient: { equals: req.user.id } }
    const broadcast: Where = { audience: { equals: 'broadcast' } }
    return { or: [own, broadcast] }
  }

  // Members update only their own personal notifications, and field access
  // (added by restrictRecipientUpdates at the end of this function) limits them
  // to isRead/readAt plus `recipientEditableFields`. A broadcast row is shared by everyone, so its
  // isRead/readAt cannot be a member's read state; members record broadcast
  // reads as notification-reads receipts (see POST /:id/read) instead.
  const ownPersonal: Access = ({ req }) => {
    if (!req.user) {return false}
    if (isAdminUser(req.user)) {return true}
    return { recipient: { equals: req.user.id } }
  }

  const access: CollectionConfig['access'] = {
    read: ownOrBroadcast,
    // Notifications are sent by the server (local API, which bypasses access)
    // or by admins. Letting any signed-in user create them would let one user
    // send messages to another from the site's own inbox.
    create: ({ req }: { req: any }) => isAdminUser(req.user),
    delete: ({ req }: { req: any }) => isAdminUser(req.user),
    update: ownPersonal,
  }

  // Build core fields
  const allFields: Field[] = [
    {
      name: 'title',
      type: 'text',
      admin: {
        description: 'The notification title that will be displayed to users',
      },
      label: 'Title',
      required: true,
    },
    {
      name: 'message',
      type: 'richText',
      admin: {
        description: 'The notification message content',
      },
      label: 'Message',
      required: true,
    },
    {
      name: 'recipient',
      type: 'relationship',
      admin: {
        description: 'The user who should receive this notification (optional if using custom recipient fields)',
      },
      label: 'Recipient',
      relationTo: 'users',
      required: false,
    },
    {
      name: 'audience',
      type: 'select',
      admin: {
        description: 'Who can see this notification. Left empty on create, it becomes "Broadcast" when there is no recipient and "Recipient only" otherwise.',
        position: 'sidebar',
      },
      index: true,
      label: 'Audience',
      options: [
        { label: 'Recipient only', value: 'user' },
        { label: 'Broadcast to everyone', value: 'broadcast' },
      ],
    },
    {
      name: 'channel',
      type: 'select',
      admin: {
        description: 'The notification channel - only subscribers to this channel will receive the notification',
        position: 'sidebar',
      },
      label: 'Channel',
      options: options.channels.map(channel => ({
        label: channel.name,
        value: channel.id,
      })),
      required: false,
    },
    {
      name: 'isRead',
      type: 'checkbox',
      admin: {
        description: 'Whether the recipient has read this notification. For broadcasts, reads return the requesting user\'s own read state.',
        position: 'sidebar',
      },
      defaultValue: false,
      label: 'Read',
    },
    {
      name: 'readAt',
      type: 'date',
      admin: {
        condition: (_: any, siblingData: any) => siblingData?.isRead,
        description: 'When this notification was marked as read',
        position: 'sidebar',
      },
      label: 'Read At',
    },
  ]

  const config: CollectionConfig = {
    slug,
    access,
    admin: {
      defaultColumns: ['title', 'audience', 'recipient', 'isRead', 'createdAt'],
      description: 'Manage user notifications and messaging',
      useAsTitle: 'title',
    },
    endpoints: markNotificationReadEndpoints,
    fields: allFields,
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
    labels,
    timestamps: true,
  }

  // Add hooks for automatic push notifications if web push is enabled
  if (options.webPush?.enabled && options.webPush.autoPush) {
    config.hooks = {
      ...config.hooks,
      afterChange: [
        async ({ doc, operation, req }) => {
          // Only send push notifications for new notifications
          if (operation !== 'create') {return}

          try {
            const webPushConfig = options.webPush!
            const pushManager = new WebPushManager(webPushConfig, req.payload)

            // Transform notification content using custom transformer or default
            const pushContent = webPushConfig.transformNotification
              ? webPushConfig.transformNotification(doc)
              : defaultNotificationTransformer(doc, { url: webPushConfig.notificationUrl })

            console.log('[Notifications Plugin] Sending push notification for notification:', doc.id)
            console.log('[Notifications Plugin] Push content:', pushContent)

            let results: Array<{ error?: any; success: boolean }> = []

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
                body: pushContent.body,
                title: pushContent.title,
                // No icon/badge fallback: the package ships no images, and an
                // absent value lets the service worker's ?icon=&badge= defaults apply.
                actions: pushContent.actions,
                badge: pushContent.badge,
                data: pushContent.data,
                icon: pushContent.icon,
                image: pushContent.image,
                requireInteraction: pushContent.requireInteraction || false,
                tag: pushContent.tag,
                timestamp: Date.now(),
              })

              results = await Promise.allSettled(
                subscriptions.map(async (sub: any) => {
                  try {
                    const pushSub = {
                      endpoint: sub.endpoint,
                      keys: {
                        auth: sub.auth,
                        p256dh: sub.p256dh,
                      },
                    }
                    await pushManager.sendNotification(pushSub, notificationPayload)
                    return { success: true }
                  } catch (error: any) {
                    // Handle expired/invalid subscriptions
                    if (error.statusCode === 410 || error.statusCode === 404) {
                      await req.payload.update({
                        id: sub.id,
                        collection: 'push-subscriptions',
                        data: { isActive: false },
                      })
                    }
                    return { error, success: false }
                  }
                })
              ).then(results =>
                results.map((result) =>
                  result.status === 'fulfilled'
                    ? result.value
                    : { error: result.reason, success: false }
                )
              )
            } else {
              // Use default behavior - send to recipient user (if recipient is provided)
              if (!doc.recipient) {
                console.warn('[Notifications Plugin] No recipient found and no findSubscriptions hook provided - skipping push notification')
                return
              }

              let recipientId: number|string

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
                  actions: pushContent.actions,
                  badge: pushContent.badge,
                  channel: doc.channel,
                  data: pushContent.data,
                  icon: pushContent.icon,
                  image: pushContent.image,
                  recipientType: 'user',
                  requireInteraction: pushContent.requireInteraction,
                  tag: pushContent.tag,
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

  const finalConfig = options.collectionOverrides?.notifications ?
    options.collectionOverrides.notifications(config) :
    config

  // Applied after the host's override so that fields the host added are
  // admin-only for updates too, unless listed in `recipientEditableFields`.
  return {
    ...finalConfig,
    fields: restrictRecipientUpdates(
      finalConfig.fields,
      options.recipientEditableFields ?? [],
      isAdminUser,
    ),
  }
}
