# @xtr-dev/payload-notifications

[![npm version](https://badge.fury.io/js/@xtr-dev%2Fpayload-notifications.svg)](https://www.npmjs.com/package/@xtr-dev/payload-notifications)

A PayloadCMS plugin that adds a configurable notifications collection for sending messages with titles, rich text content, and channel-based targeting.

⚠️ **Pre-release Warning**: This package is currently in active development (v0.0.x). Breaking changes may occur before v1.0.0. Not recommended for production use.

## Features

- 📧 Notifications collection with title and message fields
- 🔗 Configurable channels for targeting notifications
- 📱 Built-in read/unread status tracking
- 🎯 Recipient targeting support
- ⚙️ Collection customization via `collectionOverrides`
- 📅 Automatic timestamp tracking
- 🔔 Optional web push notifications support (see [WEBPUSH.md](./WEBPUSH.md))

## Installation

```bash
npm install @xtr-dev/payload-notifications
```

## Basic Usage

Add the plugin to your Payload config:

```typescript
import { buildConfig } from 'payload/config'
import { notificationsPlugin } from '@xtr-dev/payload-notifications'

export default buildConfig({
  plugins: [
    notificationsPlugin()
  ],
  // ... rest of your config
})
```

## Configuration

### Basic Configuration

Calling `notificationsPlugin()` with no options uses a single built-in `default` channel:

```typescript
notificationsPlugin()
```

### Configuration with Channels

```typescript
notificationsPlugin({
  channels: [
    { id: 'orders', name: 'Order Updates', description: 'Order status changes and shipping notifications' },
    { id: 'marketing', name: 'Marketing', description: 'Promotions and announcements' }
  ]
})
```

Each notification can be assigned one of the configured channels via its `channel` field.

> For web push notifications setup, see [WEBPUSH.md](./WEBPUSH.md). To customize access control or add fields to the generated collections, see [Email Notifications](#email-notifications) below for a `collectionOverrides` example.

## Collection Schema

The plugin creates a notifications collection with the following fields:

- **title** (required text): The notification title
- **message** (required richText): The notification content
- **recipient** (optional relationship to `users`): User who should receive the notification (optional if delivery is driven by a custom `findSubscriptions` hook instead)
- **channel** (optional select): Which configured channel the notification belongs to
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
    message: [
      {
        children: [
          { text: 'Your order has been shipped and is on its way!' }
        ]
      }
    ],
    recipient: userId,
    channel: 'orders'
  }
})
```

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
| `channels` | `NotificationChannel[]` | built-in `default` channel | Channel definitions; each notification can be assigned one via its `channel` field |
| `webPush` | `object` | `undefined` | Web push credentials and behavior — see [WEBPUSH.md](./WEBPUSH.md) |
| `collectionOverrides` | `object` | `undefined` | Functions that receive and return the generated `notifications`/`pushSubscriptions` collection config, for customizing access control, fields, or hooks |

## Examples

### E-commerce Notifications

```typescript
notificationsPlugin({
  channels: [
    { id: 'orders', name: 'Order Updates' },
    { id: 'products', name: 'Product Updates' },
    { id: 'customers', name: 'Customer Messages' }
  ]
})
```

### Content Management Notifications

```typescript
notificationsPlugin({
  channels: [
    { id: 'posts', name: 'Blog Posts' },
    { id: 'pages', name: 'Page Updates' },
    { id: 'media', name: 'Media Updates' }
  ]
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
