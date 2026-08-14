# @xtr-dev/payload-notifications

[![npm version](https://badge.fury.io/js/@xtr-dev%2Fpayload-notifications.svg)](https://www.npmjs.com/package/@xtr-dev/payload-notifications)

A PayloadCMS plugin that adds a configurable notifications collection with channels, recipient targeting, read tracking, and optional web push delivery.

⚠️ **Pre-release Warning**: This package is currently in active development (v0.0.x). Breaking changes may occur before v1.0.0. Not recommended for production use.

## Features

- 📧 Notifications collection with title and message fields
- 🗂️ Configurable notification channels
- 📱 Built-in read/unread status tracking
- 🎯 Recipient targeting support
- ⚙️ Flexible plugin configuration
- 📅 Automatic timestamp tracking
- 🔔 Optional web push notifications support (see [WEBPUSH.md](./WEBPUSH.md))

## Installation

```bash
npm install @xtr-dev/payload-notifications
```

## Basic Usage

Add the plugin to your Payload config:

```typescript
import { buildConfig } from 'payload'
import { notificationsPlugin } from '@xtr-dev/payload-notifications'

export default buildConfig({
  plugins: [
    notificationsPlugin({
      channels: [{ id: 'default', name: 'Default' }]
    }),
  ],
  // ... rest of your config
})
```

## Configuration

### Basic Configuration

```typescript
notificationsPlugin({
  channels: [
    { id: 'general', name: 'General' },
    { id: 'orders', name: 'Order updates' }
  ]
})
```

Calling `notificationsPlugin()` without an options object uses a built-in `default` channel. If you pass an options object, `channels` is required and must contain at least one channel.

### Advanced Configuration

```typescript
notificationsPlugin({
  channels: [
    { id: 'general', name: 'General', description: 'General announcements' },
    { id: 'orders', name: 'Order updates' }
  ],
  collectionOverrides: {
    notifications: (config) => ({
      ...config,
      labels: {
        singular: 'Inbox item',
        plural: 'Inbox'
      }
    })
  }
})
```

> For web push notifications setup, see [WEBPUSH.md](./WEBPUSH.md)

## Collection Schema

The plugin creates a notifications collection with the following fields:

- **title** (required text): The notification title
- **message** (required richText): The notification content
- **recipient** (optional relationship): User who should receive the notification (optional if using custom recipient fields)
- **channel** (select): One of the configured notification channels
- **isRead** (checkbox): Read status tracking
- **readAt** (date): When the notification was read
- **createdAt/updatedAt**: Automatic timestamps

## API Usage

### Creating Notifications

```typescript
const notification = await payload.create({
  collection: 'notifications',
  data: {
    title: 'Order Shipped',
    message: {
      root: {
        type: 'root',
        children: [{
          type: 'paragraph',
          children: [{
            type: 'text',
            text: 'Your order has been shipped and is on its way!',
            version: 1
          }],
          version: 1
        }],
        direction: null,
        format: '',
        indent: 0,
        version: 1
      }
    },
    recipient: userId,
    channel: 'orders'
  }
})
```

The `message` value above uses Payload 3's Lexical rich-text shape. If the host config uses another rich-text editor, supply the document shape required by that editor instead.

### Querying Notifications

```typescript
// Get unread notifications for a user
const unreadNotifications = await payload.find({
  collection: 'notifications',
  where: {
    and: [
      { recipient: { equals: userId } },
      { isRead: { equals: false } }
    ]
  },
  sort: '-createdAt'
})

// Mark notification as read
await payload.update({
  collection: 'notifications',
  id: notificationId,
  data: {
    isRead: true,
    readAt: new Date()
  }
})
```

## Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `channels` | `NotificationChannel[]` | Required with an options object | Channels available on notifications; must not be empty |
| `collectionOverrides` | `object` | `undefined` | Functions that customize the generated `notifications` and `pushSubscriptions` collection configs |
| `webPush` | `WebPushConfig` | `undefined` | Optional web push credentials, delivery behavior, and hooks |

## Examples

### Multiple Channels

```typescript
notificationsPlugin({
  channels: [
    { id: 'orders', name: 'Order updates' },
    { id: 'products', name: 'Product updates' },
    { id: 'promotions', name: 'Promotions' }
  ]
})
```

### Customize the Notifications Collection

```typescript
notificationsPlugin({
  channels: [{ id: 'content', name: 'Content updates' }],
  collectionOverrides: {
    notifications: (config) => ({
      ...config,
      fields: [
        ...config.fields,
        { name: 'sourceURL', type: 'text', label: 'Source URL' }
      ]
    })
  }
})
```

## Email Notifications

You can add email functionality to notifications using the `collectionOverrides` option. This allows you to add custom hooks to the notifications collection without modifying the plugin code.

### Using Collection Overrides

The key is to preserve existing hooks (like web push) while adding your own:

```typescript
import { notificationsPlugin } from '@xtr-dev/payload-notifications'

notificationsPlugin({
  channels: [{ id: 'default', name: 'Default' }],
  collectionOverrides: {
    notifications: (config) => ({
      ...config,
      hooks: {
        ...config.hooks, // Preserve existing hooks (web push, etc.)
        afterChange: [
          ...(config.hooks?.afterChange || []), // Preserve existing afterChange hooks
          // Add your custom email hook
          async ({ doc, operation, req }) => {
            if (operation === 'create') {
              // Your email logic here
            }
          }
        ]
      }
    })
  }
})
```

### Example: Custom Email Service

```typescript
import { notificationsPlugin } from '@xtr-dev/payload-notifications'
import { sendEmail } from './your-email-service'
import { renderNotificationEmail } from './email-templates'

notificationsPlugin({
  channels: [{ id: 'default', name: 'Default' }],
  collectionOverrides: {
    notifications: (config) => ({
      ...config,
      hooks: {
        ...config.hooks,
        afterChange: [
          ...(config.hooks?.afterChange || []),
          async ({ doc, operation, req }) => {
            // Send email when notification is created
            if (operation === 'create') {
              try {
                // Get recipient user details
                let recipientId = doc.recipient
                if (typeof recipientId === 'object' && recipientId?.id) {
                  recipientId = recipientId.id
                }

                if (!recipientId) {
                  console.log('No recipient for email notification')
                  return
                }

                const recipient = await req.payload.findByID({
                  collection: 'users',
                  id: recipientId
                })

                if (!recipient?.email) {
                  console.log('Recipient has no email address')
                  return
                }

                // Send email
                await sendEmail({
                  to: recipient.email,
                  subject: doc.title,
                  html: renderNotificationEmail(doc)
                })

                console.log(`Email sent to ${recipient.email}`)
              } catch (error) {
                console.error('Failed to send notification email:', error)
                // Don't throw - we don't want to prevent notification creation
              }
            }
          }
        ]
      }
    })
  }
})
```

**Important Notes:**
- Always spread existing hooks (`...config.hooks`) to preserve plugin functionality
- Use the spread operator for hook arrays (`...(config.hooks?.afterChange || [])`)
- Don't throw errors in hooks if you want to allow notification creation to succeed even if email fails
- Email sending happens asynchronously after the notification is created

## Web Push Notifications

The plugin includes optional web push notifications support for PWA and mobile browser users. For complete setup instructions, configuration options, and usage examples, see [WEBPUSH.md](./WEBPUSH.md).

## TypeScript Support

The plugin includes full TypeScript support. Types are automatically generated based on your configuration.

## License

MIT
