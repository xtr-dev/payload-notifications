import type {CollectionConfig, Config} from 'payload'
import type {RequestOptions} from 'web-push'

/**
 * Web push subscription data structure
 */
export interface PushSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

/**
 * Notification channel configuration
 */
export interface NotificationChannel {
  /** Unique channel identifier */
  id: string
  /** Display name for the channel */
  name: string
  /** Channel description */
  description?: string
}

/**
 * Content of a push notification, as returned by `transformNotification`
 */
export interface PushNotificationContent {
  title: string
  body: string
  icon?: string
  badge?: string
  image?: string
  data?: any
  actions?: Array<{ action: string; title: string; icon?: string }>
  tag?: string
  requireInteraction?: boolean
}

/**
 * Web push configuration options
 */
export interface WebPushConfig {
  /** VAPID public key for push notifications */
  vapidPublicKey: string
  /** VAPID private key for push notifications */
  vapidPrivateKey: string
  /** Contact email for VAPID */
  vapidSubject: string
  /** Enable web push notifications */
  enabled?: boolean
  /** Custom push notification options */
  options?: RequestOptions
  /** Automatically send push notifications when notifications are created */
  autoPush?: boolean
  /**
   * Where a click on a push opens, used by the default transformer (ignored
   * when `transformNotification` is set). A function receives the
   * notification document. Defaults to `/`.
   */
  notificationUrl?: ((notification: any) => string) | string
  /** Custom notification content transformer */
  transformNotification?: (notification: any) => PushNotificationContent
  /**
   * Custom hook to find push subscriptions for a notification
   * This allows implementing anonymous notifications or custom recipient logic
   * If not provided, defaults to user-based subscriptions
   */
  findSubscriptions?: (notification: any, payload: any) => Promise<any[]>
}

/**
 * Main plugin configuration options
 */
export interface NotificationsPluginOptions {
  /** Collection configuration */
  collectionOverrides?: {
    /** The `notification-reads` collection that stores per-user broadcast read receipts */
    notificationReads?: (config: CollectionConfig) => CollectionConfig
    notifications?: (config: CollectionConfig) => CollectionConfig
    pushSubscriptions?: (config: CollectionConfig) => CollectionConfig
  }
  /** Web push notification configuration */
  webPush?: WebPushConfig
  /** Notification channels configuration */
  channels: NotificationChannel[]
}

/**
 * Plugin function type
 */
export type NotificationsPlugin = (options?: NotificationsPluginOptions) => (config: Config) => Config
