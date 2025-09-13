import type { CollectionConfig, Field } from 'payload'
import type { NotificationsPluginOptions, NotificationAccess } from '../types'
import { buildRelationshipFields } from '../utils/buildFields'
import { WebPushManager } from '../utils/webPush'
import { defaultNotificationTransformer } from '../utils/richTextExtractor'

/**
 * Creates the notifications collection configuration
 * Includes core fields plus dynamically generated relationship fields
 */
export function createNotificationsCollection(options: NotificationsPluginOptions = {}): CollectionConfig {
  const {
    collections = {},
    relationships = [],
    access = {},
    fields: customFields = [],
  } = options

  const slug = collections.slug || 'notifications'
  const labels = {
    singular: collections.labels?.singular || 'Notification',
    plural: collections.labels?.plural || 'Notifications',
  }

  // Default access control - authenticated users can read, admins can manage
  const defaultAccess: NotificationAccess = {
    read: ({ req }: { req: any }) => Boolean(req.user),
    create: ({ req }: { req: any }) => Boolean(req.user),
    update: ({ req }: { req: any }) => Boolean(req.user),
    delete: ({ req }: { req: any }) => Boolean(req.user?.role === 'admin'),
  }

  // Build channel field if channels are configured
  const channelField: Field[] = options.channels && options.channels.length > 0 ? [
    {
      name: 'channel',
      type: 'select',
      label: 'Channel',
      options: options.channels.map(channel => ({
        label: channel.name,
        value: channel.id,
      })),
      required: false,
      admin: {
        description: 'The notification channel - only subscribers to this channel will receive the notification',
        position: 'sidebar',
      },
    },
  ] : []

  // Default recipient field (relationship to users)
  // Users can add custom recipient fields via the fields option and use findSubscriptions hook
  const recipientField: Field = {
    name: 'recipient',
    type: 'relationship',
    relationTo: 'users',
    label: 'Recipient',
    required: false,
    admin: {
      description: 'The user who should receive this notification (optional if using custom recipient fields)',
    },
  }

  // Build core fields
  const coreFields: Field[] = [
    {
      name: 'title',
      type: 'text',
      label: 'Title',
      required: true,
      admin: {
        description: 'The notification title that will be displayed to users',
      },
    },
    {
      name: 'message',
      type: 'richText',
      label: 'Message',
      required: true,
      admin: {
        description: 'The notification message content',
      },
    },
    recipientField,
    ...channelField,
    {
      name: 'isRead',
      type: 'checkbox',
      label: 'Read',
      defaultValue: false,
      admin: {
        description: 'Whether this notification has been read by the recipient',
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

  // Build relationship fields
  const relationshipFields = buildRelationshipFields(relationships)

  // Combine all fields
  const allFields = [...coreFields, ...relationshipFields, ...customFields]

  const config: CollectionConfig = {
    slug,
    labels,
    admin: {
      useAsTitle: 'title',
      defaultColumns: ['title', 'recipient', 'isRead', 'createdAt'],
      description: 'Manage user notifications and messaging',
    },
    fields: allFields,
    access: {
      read: access.read || defaultAccess.read!,
      create: access.create || defaultAccess.create!,
      update: access.update || defaultAccess.update!,
      delete: access.delete || defaultAccess.delete!,
    },
    timestamps: true,
  }

  // Add hooks for automatic push notifications if web push is enabled
  if (options.webPush?.enabled && options.webPush.autoPush) {
    config.hooks = {
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

              let recipientId: string
              
              if (typeof doc.recipient === 'string') {
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

  return config
}