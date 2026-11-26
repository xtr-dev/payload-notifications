/**
 * Utility functions for extracting plain text from Payload rich text fields
 */
import type { PushNotificationContent } from '../types.js'

/**
 * Node types that sit inside a line of text rather than forming their own
 * block. Lexical uses `text`, `link`, `autolink`, `linebreak` and `tab`
 * (plus `code-highlight` inside code blocks); Slate uses `link` for inline
 * links and leaves text leaves untyped.
 */
const INLINE_NODE_TYPES = new Set(['autolink', 'code-highlight', 'linebreak', 'link', 'tab', 'text'])

/**
 * Extract plain text from Payload rich text content.
 *
 * Accepts a plain string, Lexical editor state (`{ root: { children } }`,
 * Payload 3's default editor), a bare Lexical node, or a Slate value (an
 * array of block nodes). Inline nodes such as text and links are joined
 * without a separator so formatted runs of one word stay intact, while
 * block nodes (paragraphs, headings, list items, quotes, table cells) and
 * line breaks are separated by a single space. Runs of whitespace are
 * collapsed, since the result is a one-line excerpt for a push body.
 */
export function extractTextFromRichText(richText: any): string {
  if (!richText) {return ''}

  if (typeof richText === 'string') {
    return richText
  }

  const root = isObject(richText) && isObject(richText.root) ? richText.root : richText

  return renderNode(root).replace(/\s+/g, ' ').trim()
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null
}

/**
 * Render one rich text node, or an array of sibling nodes, to text. Block
 * nodes are padded with spaces so that adjacent blocks never run together;
 * the caller collapses the padding.
 */
function renderNode(node: any): string {
  if (typeof node === 'string') {return node}
  if (Array.isArray(node)) {return node.map(renderNode).join('')}
  if (!isObject(node)) {return ''}

  if (node.type === 'linebreak' || node.type === 'tab') {return ' '}
  if (typeof node.text === 'string') {return node.text}
  if (!Array.isArray(node.children)) {return ''}

  const inner = node.children.map(renderNode).join('')
  return typeof node.type === 'string' && INLINE_NODE_TYPES.has(node.type) ? inner : ` ${inner} `
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (!text || text.length <= maxLength) {return text}
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
    body,
    data: {
      id: notification.id,
      createdAt: notification.createdAt,
      notificationId: notification.id,
      trackClose: true,
      url,
    },
    requireInteraction: false,
    tag: `notification-${notification.id}`,
    title,
  }
}
