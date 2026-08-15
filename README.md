# @xtr-dev/payload-notifications

[![npm version](https://badge.fury.io/js/@xtr-dev%2Fpayload-notifications.svg)](https://www.npmjs.com/package/@xtr-dev/payload-notifications)

A PayloadCMS plugin that adds a configurable notifications collection for sending channel-targeted messages with titles and rich text content.

⚠️ **Pre-release Warning**: This package is currently in active development (v0.0.x). Breaking changes may occur before v1.0.0. Not recommended for production use.

## Features

- 📧 Notifications collection with title and message fields
- 📢 Channel-based targeting via a configurable `channels` list
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
import { buildConfig } from 'payload/config'
import { notificationsPlugin } from '@xtr-dev/payload-notifications'

export default buildConfig({
  plugins: [
    notificationsPlugin({
      // Basic configuration
    })
  ],
  // ... rest of your config
})
```

## Configuration

### Basic Configuration

```typescript
notificationsPlugin({
  channels: [
    { id: 'default', name: 'Default' }
  ]
})
```

`channels` is required — the plugin throws if the array is empty. Each channel becomes an option in the notification's `channel` select field.

### Advanced Configuration

Use `collectionOverrides` to customize the generated collection, for example to tighten access control:

```typescript
notificationsPlugin({
  channels: [
    { id: 'orders', name: 'Orders', description: 'Order status updates' },
    { id: 'marketing', name: 'Marketing' }
  ],
  collectionOverrides: {
    notifications: (config) => ({
      ...config,
      access: {
        ...config.access,
        create: ({ req }) => Boolean(req.user?.role === 'admin'),
      }
    })
  }
})
```

> For web push notifications setup, see [WEBPUSH.md](./WEBPUSH.md)

## Collection Schema

The plugin creates a `notifications` collection (the slug is fixed, not configurable) with the following fields:

- **title** (required text): The notification title
- **message** (required richText): The notification content
- **recipient** (optional relationship to `users`): User who should receive the notification (optional if using custom recipient fields)
- **channel** (select, options generated from `channels`): Which configured channel the notification belongs to
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
| `channels` | `NotificationChannel[]` | `[{ id: 'default', name: 'Default', description: 'Default channel' }]` | Required. Populates the notification's `channel` select field; the plugin throws if the array is empty. |
| `webPush` | `WebPushConfig` | `undefined` | Optional web push configuration — see [WEBPUSH.md](./WEBPUSH.md) |
| `collectionOverrides.notifications` | `(config: CollectionConfig) => CollectionConfig` | `undefined` | Transform the generated notifications collection config before it's added to Payload |
| `collectionOverrides.pushSubscriptions` | `(config: CollectionConfig) => CollectionConfig` | `undefined` | Transform the generated push-subscriptions collection config before it's added to Payload |

## Examples

### E-commerce Notifications

```typescript
notificationsPlugin({
  channels: [
    { id: 'orders', name: 'Orders', description: 'Order status updates' },
    { id: 'promotions', name: 'Promotions', description: 'Sales and offers' }
  ]
})
```

### Content Management Notifications

```typescript
notificationsPlugin({
  channels: [
    { id: 'posts', name: 'Blog Posts' },
    { id: 'comments', name: 'Comments' }
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
