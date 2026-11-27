import type { Payload } from 'payload'

import webpush from 'web-push'

import type { PushSubscription, WebPushConfig } from '../types.js'

import { isSubscribedToChannel } from './channelSubscriptions.js'

/**
 * Thrown when subscribe is asked to write an endpoint owned by another user.
 * The HTTP handler maps this to 403; other errors stay 500.
 */
export class PushSubscriptionOwnershipError extends Error {
  constructor() {
    super('Push subscription belongs to another user')
    this.name = 'PushSubscriptionOwnershipError'
  }
}

/**
 * Web Push utility class for handling push notifications
 */
export class WebPushManager {
  private config: WebPushConfig
  private initialized = false
  private payload: Payload

  constructor(config: WebPushConfig, payload: Payload) {
    this.config = config
    this.payload = payload
  }

  /**
   * Get VAPID public key for client-side subscription
   */
  public getVapidPublicKey(): string {
    return this.config.vapidPublicKey
  }

  /**
   * Initialize web-push with VAPID details
   */
  public init(): void {
    if (this.initialized) {return}

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
    payload: Buffer | string,
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
   * Send push notification to all active subscriptions for a recipient.
   * Nothing is sent to a user who opted out of `options.channel` in the
   * channel-subscriptions collection; the result is then an empty array.
   */
  public async sendToRecipient(
    recipientId: number|string,
    title: string,
    body: string,
    options?: {
      actions?: Array<{ action: string; icon?: string; title: string }>
      badge?: string
      channel?: string
      data?: any
      icon?: string
      image?: string
      recipientType?: 'email' | 'text' | 'user'
      requireInteraction?: boolean
      tag?: string
    }
  ): Promise<Array<{ error?: any; success: boolean }>> {
    // The user's own channel opt-out comes before the per-device channel
    // filter below. It only applies to user recipients, because text/email
    // recipients have no user to hold a preference.
    const isUserRecipient = options?.recipientType !== 'text' && options?.recipientType !== 'email'
    if (
      options?.channel &&
      isUserRecipient &&
      !(await isSubscribedToChannel({ channel: options.channel, payload: this.payload, user: recipientId }))
    ) {
      return []
    }

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
      body,
      title,
      // No icon/badge fallback: the package ships no images, and an absent
      // value lets the service worker's ?icon=&badge= defaults apply.
      actions: options?.actions,
      badge: options?.badge,
      data: options?.data,
      icon: options?.icon,
      image: options?.image,
      requireInteraction: options?.requireInteraction || false,
      tag: options?.tag,
      timestamp: Date.now(),
    })

    const results = await Promise.allSettled(
      subscriptions.docs.map(async (sub: any) => {
        try {
          const pushSub: PushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              auth: sub.auth,
              p256dh: sub.p256dh,
            },
          }

          await this.sendNotification(pushSub, notificationPayload)
          return { success: true }
        } catch (error: any) {
          // Handle expired/invalid subscriptions
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Mark subscription as inactive
            await this.payload.update({
              id: sub.id,
              collection: 'push-subscriptions',
              data: { isActive: false },
            })
          }
          return { error, success: false }
        }
      })
    )

    return results.map((result) =>
      result.status === 'fulfilled'
        ? result.value
        : { error: result.reason, success: false }
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
      actions?: Array<{ action: string; icon?: string; title: string }>
      badge?: string
      channel?: string
      data?: any
      icon?: string
      image?: string
      requireInteraction?: boolean
      tag?: string
    }
  ): Promise<Array<{ error?: any; success: boolean }>> {
    return this.sendToRecipient(userId, title, body, {
      ...options,
      recipientType: 'user'
    })
  }

  /**
   * Subscribe a user to push notifications.
   * The endpoint lookup is global because `endpoint` is unique, but the
   * matching row is only writable by its owner: a caller who knows someone
   * else's endpoint cannot overwrite that row's keys or `user`. These Local
   * API calls have no request context, so collection access does not apply.
   */
  public async subscribe(
    userId: number | string,
    subscription: PushSubscription,
    userAgent?: string,
    channels?: string[]
  ): Promise<void> {
    try {
      const existing = await this.payload.find({
        collection: 'push-subscriptions',
        depth: 0,
        limit: 1,
        where: {
          endpoint: { equals: subscription.endpoint },
        },
      })

      // userId and channels are cast to `any` below because a consumer's generated
      // Payload types narrow `user` and `channels` to that consumer's own relationship
      // and select-option unions (e.g. specific channel ids), which this plugin cannot
      // know statically - its own public contract stays string|number and string[].
      if (existing.docs.length > 0) {
        const existingUser = existing.docs[0].user
        const ownerId =
          existingUser != null && typeof existingUser === 'object' && 'id' in existingUser
            ? (existingUser as { id: number | string }).id
            : existingUser

        if (String(ownerId) !== String(userId)) {
          throw new PushSubscriptionOwnershipError()
        }

        await this.payload.update({
          id: existing.docs[0].id,
          collection: 'push-subscriptions',
          data: {
            auth: subscription.keys.auth,
            channels: channels as any,
            isActive: true,
            p256dh: subscription.keys.p256dh,
            user: userId as any,
            userAgent,
          },
        })
      } else {
        await this.payload.create({
          collection: 'push-subscriptions',
          data: {
            auth: subscription.keys.auth,
            channels: channels as any,
            endpoint: subscription.endpoint,
            isActive: true,
            p256dh: subscription.keys.p256dh,
            user: userId as any,
            userAgent,
          },
        })
      }
    } catch (error) {
      if (error instanceof PushSubscriptionOwnershipError) {
        throw error
      }
      console.error('Failed to save push subscription:', error)
      throw error
    }
  }

  /**
   * Deactivate a push subscription, scoped to the owning user so one user
   * cannot deactivate another user's subscription by supplying their endpoint.
   */
  public async unsubscribe(userId: number | string, endpoint: string): Promise<void> {
    try {
      const subscription = await this.payload.find({
        collection: 'push-subscriptions',
        limit: 1,
        where: {
          and: [
            { endpoint: { equals: endpoint } },
            { user: { equals: userId } },
          ],
        },
      })

      if (subscription.docs.length === 0) {
        return
      }

      await this.payload.update({
        id: subscription.docs[0].id,
        collection: 'push-subscriptions',
        data: { isActive: false },
      })
    } catch (error) {
      console.error('Failed to unsubscribe:', error)
      throw error
    }
  }
}
