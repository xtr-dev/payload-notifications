import type {CollectionConfig, Config} from 'payload'
import type {RequestOptions} from 'web-push'

/**
 * Web push subscription data structure
 */
export interface PushSubscription {
  endpoint: string
  keys: {
    auth: string
    p256dh: string
  }
}

/**
 * Notification channel configuration
 */
export interface NotificationChannel {
  /** Channel description */
  description?: string
  /** Unique channel identifier */
  id: string
  /** Display name for the channel */
  name: string
}

/**
 * Content of a push notification, as returned by `transformNotification`
 */
export interface PushNotificationContent {
  actions?: Array<{ action: string; icon?: string; title: string }>
  badge?: string
  body: string
  data?: any
  icon?: string
  image?: string
  requireInteraction?: boolean
  tag?: string
  title: string
}

/**
 * Web push configuration options
 */
export interface WebPushConfig {
  /** Automatically send push notifications when notifications are created */
  autoPush?: boolean
  /** Enable web push notifications */
  enabled?: boolean
  /**
   * Custom hook to find push subscriptions for a notification
   * This allows implementing anonymous notifications or custom recipient logic
   * If not provided, defaults to user-based subscriptions
   */
  findSubscriptions?: (notification: any, payload: any) => Promise<any[]>
  /**
   * Where a click on a push opens, used by the default transformer (ignored
   * when `transformNotification` is set). A function receives the
   * notification document. Defaults to `/`.
   */
  notificationUrl?: ((notification: any) => string) | string
  /** Custom push notification options */
  options?: RequestOptions
  /** Custom notification content transformer */
  transformNotification?: (notification: any) => PushNotificationContent
  /** VAPID private key for push notifications */
  vapidPrivateKey: string
  /** VAPID public key for push notifications */
  vapidPublicKey: string
  /** Contact email for VAPID */
  vapidSubject: string
}

/**
 * Main plugin configuration options
 */
export interface NotificationsPluginOptions {
  /** Notification channels configuration */
  channels: NotificationChannel[]
  /** Collection configuration */
  collectionOverrides?: {
    /** The `notification-reads` collection that stores per-user broadcast read receipts */
    notificationReads?: (config: CollectionConfig) => CollectionConfig
    notifications?: (config: CollectionConfig) => CollectionConfig
    pushSubscriptions?: (config: CollectionConfig) => CollectionConfig
  }
  /** Web push notification configuration */
  webPush?: WebPushConfig
}

/**
 * Plugin function type
 */
export type NotificationsPlugin = (options?: NotificationsPluginOptions) => (config: Config) => Config
