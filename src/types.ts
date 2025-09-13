import type { Config, CollectionConfig, Access, Field } from 'payload'
import type * as webpush from 'web-push'

/**
 * Configuration for a relationship field in the notifications collection
 */
export interface NotificationRelationship {
  /** Field name in the attachments group */
  name: string
  /** Target collection slug to relate to */
  relationTo: string
  /** Label displayed in admin UI */
  label?: string
  /** Whether this relationship is required */
  required?: boolean
  /** Allow multiple selections */
  hasMany?: boolean
}

/**
 * Collection configuration options
 */
export interface NotificationCollectionConfig {
  /** Collection slug */
  slug?: string
  /** Collection labels for admin UI */
  labels?: {
    singular?: string
    plural?: string
  }
}

/**
 * Access control configuration for notifications collection
 */
export interface NotificationAccess {
  read?: Access
  create?: Access
  update?: Access
  delete?: Access
}

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
  /** Default enabled state for new subscriptions */
  defaultEnabled?: boolean
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
  options?: webpush.RequestOptions
  /** Automatically send push notifications when notifications are created */
  autoPush?: boolean
  /** Custom notification content transformer */
  transformNotification?: (notification: any) => {
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
  collections?: NotificationCollectionConfig
  /** Array of configurable relationship fields */
  relationships?: NotificationRelationship[]
  /** Custom access control functions */
  access?: NotificationAccess
  /** Additional custom fields to add to the collection */
  fields?: Field[]
  /** Web push notification configuration */
  webPush?: WebPushConfig
  /** Notification channels configuration */
  channels?: NotificationChannel[]
}

/**
 * Plugin function type
 */
export type NotificationsPlugin = (options?: NotificationsPluginOptions) => (config: Config) => Config