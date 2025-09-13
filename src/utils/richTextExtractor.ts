/**
 * Utility functions for extracting plain text from Payload rich text fields
 */

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
 * Default notification content transformer
 * Converts a notification document to push notification format
 */
export function defaultNotificationTransformer(notification: any) {
  const title = notification.title || 'New Notification'
  
  // Extract plain text from rich text message
  const messageText = extractTextFromRichText(notification.message)
  const body = truncateText(messageText, 120) || 'You have a new notification'

  return {
    title,
    body,
    icon: '/icons/notification-icon.png',
    badge: '/icons/notification-badge.png',
    image: undefined, // Optional image property
    data: {
      notificationId: notification.id,
      url: `/admin/collections/notifications/${notification.id}`,
      createdAt: notification.createdAt,
    },
    actions: [
      { action: 'view', title: 'View', icon: '/icons/view.png' },
      { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss.png' }
    ],
    tag: `notification-${notification.id}`,
    requireInteraction: false,
  }
}