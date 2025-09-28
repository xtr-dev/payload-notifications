import webpush from 'web-push'
import type { Payload } from 'payload'
import type { WebPushConfig, PushSubscription } from '../types'

/**
 * Web Push utility class for handling push notifications
 */
export class WebPushManager {
  private config: WebPushConfig
  private payload: Payload
  private initialized = false

  constructor(config: WebPushConfig, payload: Payload) {
    this.config = config
    this.payload = payload
  }

  /**
   * Initialize web-push with VAPID details
   */
  public init(): void {
    if (this.initialized) return

    webpush.setVapidDetails(
      this.config.vapidSubject,
      this.config.vapidPublicKey,
      this.config.vapidPrivateKey
    )

    this.initialized = true
  }

  /**
   * Send push notification to a specific subscription
   */
  public async sendNotification(
    subscription: PushSubscription,
    payload: string | Buffer,
    options?: webpush.RequestOptions
  ): Promise<webpush.SendResult> {
    this.init()

    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    }

    const requestOptions = {
      ...this.config.options,
      ...options,
    }

    return webpush.sendNotification(pushSubscription, payload, requestOptions)
  }

  /**
   * Send push notification to all active subscriptions for a recipient
   */
  public async sendToRecipient(
    recipientId: string|number,
    title: string,
    body: string,
    options?: {
      icon?: string
      badge?: string
      image?: string
      data?: any
      actions?: Array<{ action: string; title: string; icon?: string }>
      tag?: string
      requireInteraction?: boolean
      channel?: string
      recipientType?: 'user' | 'text' | 'email'
    }
  ): Promise<Array<{ success: boolean; error?: any }>> {
    // Build query conditions for filtering subscriptions based on recipient type
    const whereConditions: any[] = [
      { isActive: { equals: true } },
    ]

    // Add recipient filtering based on type
    if (options?.recipientType === 'text' || options?.recipientType === 'email') {
      // For text/email recipients, look for recipient field
      whereConditions.push({ recipient: { equals: recipientId } })
    } else {
      // Default to user relationship
      whereConditions.push({ user: { equals: recipientId } })
    }

    // Add channel filtering if specified
    if (options?.channel) {
      whereConditions.push({
        or: [
          { channels: { contains: options.channel } },
          { channels: { contains: 'all' } },
          { channels: { exists: false } }, // Handle subscriptions without channels field (backwards compatibility)
        ],
      })
    }

    // Get all active push subscriptions for the user filtered by channel
    const subscriptions = await this.payload.find({
      collection: 'push-subscriptions',
      where: {
        and: whereConditions,
      },
    })

    if (subscriptions.docs.length === 0) {
      return []
    }

    const notificationPayload = JSON.stringify({
      title,
      body,
      icon: options?.icon || '/icon-192x192.png',
      badge: options?.badge || '/badge-72x72.png',
      image: options?.image,
      data: options?.data,
      actions: options?.actions,
      tag: options?.tag,
      requireInteraction: options?.requireInteraction || false,
      timestamp: Date.now(),
    })

    const results = await Promise.allSettled(
      subscriptions.docs.map(async (sub: any) => {
        try {
          const pushSub: PushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          }

          await this.sendNotification(pushSub, notificationPayload)
          return { success: true }
        } catch (error: any) {
          // Handle expired/invalid subscriptions
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Mark subscription as inactive
            await this.payload.update({
              collection: 'push-subscriptions',
              id: sub.id,
              data: { isActive: false },
            })
          }
          return { success: false, error }
        }
      })
    )

    return results.map((result) =>
      result.status === 'fulfilled'
        ? result.value
        : { success: false, error: result.reason }
    )
  }

  /**
   * Send push notification to all active subscriptions for a user (backward compatibility)
   * @deprecated Use sendToRecipient instead
   */
  public async sendToUser(
    userId: string,
    title: string,
    body: string,
    options?: {
      icon?: string
      badge?: string
      image?: string
      data?: any
      actions?: Array<{ action: string; title: string; icon?: string }>
      tag?: string
      requireInteraction?: boolean
      channel?: string
    }
  ): Promise<Array<{ success: boolean; error?: any }>> {
    return this.sendToRecipient(userId, title, body, {
      ...options,
      recipientType: 'user'
    })
  }

  /**
   * Subscribe a user to push notifications
   */
  public async subscribe(
    userId: string | number,
    subscription: PushSubscription,
    userAgent?: string,
    channels?: string[]
  ): Promise<void> {
    try {
      // Check if subscription already exists
      const existing = await this.payload.find({
        collection: 'push-subscriptions',
        where: {
          endpoint: { equals: subscription.endpoint },
        },
        limit: 1,
      })

      if (existing.docs.length > 0) {
        // Update existing subscription
        await this.payload.update({
          collection: 'push-subscriptions',
          id: existing.docs[0].id,
          data: {
            user: userId,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userAgent,
            channels,
            isActive: true,
          },
        })
      } else {
        // Create new subscription
        await this.payload.create({
          collection: 'push-subscriptions',
          data: {
            user: userId,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userAgent,
            channels,
            isActive: true,
          },
        })
      }
    } catch (error) {
      console.error('Failed to save push subscription:', error)
      throw error
    }
  }

  /**
   * Unsubscribe a user from push notifications
   */
  public async unsubscribe(endpoint: string): Promise<void> {
    try {
      const subscription = await this.payload.find({
        collection: 'push-subscriptions',
        where: {
          endpoint: { equals: endpoint },
        },
        limit: 1,
      })

      if (subscription.docs.length > 0) {
        await this.payload.update({
          collection: 'push-subscriptions',
          id: subscription.docs[0].id,
          data: { isActive: false },
        })
      }
    } catch (error) {
      console.error('Failed to unsubscribe:', error)
      throw error
    }
  }

  /**
   * Get VAPID public key for client-side subscription
   */
  public getVapidPublicKey(): string {
    return this.config.vapidPublicKey
  }
}
