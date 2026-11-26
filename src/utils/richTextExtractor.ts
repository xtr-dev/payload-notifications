/**
 * Utility functions for extracting plain text from Payload rich text fields
 */
import type { PushNotificationContent } from '../types.js'

/**
 * Extract plain text from Payload rich text content
 * Supports both Lexical and Slate formats
 */
export function extractTextFromRichText(richText: any): string {
  if (!richText) return ''
  
  if (typeof richText === 'string') {
    return richText
  }

  if (Array.isArray(richText)) {
    return richText
      .map(block => extractTextFromBlock(block))
      .filter(Boolean)
      .join(' ')
  }

  return ''
}

/**
 * Extract text from a rich text block
 */
function extractTextFromBlock(block: any): string {
  if (!block) return ''

  // Handle Lexical format (Payload 3.x default)
  if (block.type === 'paragraph' || block.type === 'heading') {
    return extractTextFromChildren(block.children || [])
  }

  // Handle direct children array
  if (block.children && Array.isArray(block.children)) {
    return extractTextFromChildren(block.children)
  }

  // Handle text nodes directly
  if (typeof block.text === 'string') {
    return block.text
  }

  // Handle Slate format (legacy)
  if (block.type === 'p' || block.type === 'h1' || block.type === 'h2') {
    return extractTextFromChildren(block.children || [])
  }

  return ''
}

/**
 * Extract text from children array
 */
function extractTextFromChildren(children: any[]): string {
  if (!Array.isArray(children)) return ''

  return children
    .map(child => {
      if (typeof child === 'string') return child
      if (typeof child.text === 'string') return child.text
      if (child.children) return extractTextFromChildren(child.children)
      return ''
    })
    .join('')
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Options for the default notification content transformer
 */
export interface DefaultNotificationTransformerOptions {
  /**
   * Where a click on the push opens. A function receives the notification
   * document. Defaults to `/`, because recipients are usually not admins and
   * cannot open the notification in the admin panel.
   */
  url?: ((notification: any) => string) | string
}

/**
 * Default notification content transformer.
 * Converts a notification document to push notification content: the title,
 * a plain-text excerpt of the message, a click URL, and the `id`/`trackClose`
 * data the service worker needs to report a closed notification to
 * `/api/push-notifications/track`. It sets no icon, badge or actions, since
 * the package ships no image files; set them in a custom
 * `transformNotification`, or set worker-wide defaults with the service
 * worker's `?icon=&badge=` registration parameters.
 */
export function defaultNotificationTransformer(
  notification: any,
  options: DefaultNotificationTransformerOptions = {},
): PushNotificationContent {
  const title = notification.title || 'New Notification'

  // Extract plain text from rich text message
  const messageText = extractTextFromRichText(notification.message)
  const body = truncateText(messageText, 120) || 'You have a new notification'
  const url = typeof options.url === 'function' ? options.url(notification) : options.url || '/'

  return {
    title,
    body,
    data: {
      id: notification.id,
      notificationId: notification.id,
      url,
      createdAt: notification.createdAt,
      trackClose: true,
    },
    tag: `notification-${notification.id}`,
    requireInteraction: false,
  }
}
