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
import { buildConfig } from 'payload'
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
- **audience** (select, `user` or `broadcast`): Who can see the notification. Left out on create, it is `broadcast` when there is no recipient and `user` otherwise. A broadcast cannot have a recipient.
- **channel** (optional select): Which configured channel the notification belongs to
- **isRead** (checkbox): Read status tracking. For broadcasts, reads by a signed-in user return that user's own read state (see below)
- **readAt** (date): When the notification was read
- **createdAt/updatedAt**: Automatic timestamps

A `notification-reads` collection stores one row per user and broadcast they have read, because a broadcast is a single row shared by every user. Deleting a user (through Payload) also deletes their personal notifications, read receipts and push subscriptions.

### Default Access

| Operation | Admins (`role === 'admin'`) | Other signed-in users |
|-----------|-----------------------------|-----------------------|
| read | all | their own (`recipient` is them) and broadcasts |
| create, delete | yes | no |
| update | all fields | `isRead`/`readAt` of their own personal notifications |

Server code that creates notifications through the local API is unaffected, since it bypasses access control by default. A personal notification whose recipient has been removed (for example by deleting the user directly in the database) stays `audience: 'user'` and is only visible to admins.

It also always creates a `push-subscriptions` collection, even when web push is disabled, so generated types and the database schema do not depend on whether VAPID keys are configured. Without `webPush.enabled` the collection simply stays empty: no push endpoints are registered, no pushes are sent, and only admins (`role === 'admin'`) can access it through REST/GraphQL/admin (the local API bypasses access control as usual). See [WEBPUSH.md](./WEBPUSH.md).

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

### Read State for Users

`POST /api/notifications/:id/read` marks a notification read for the signed-in user, and `DELETE` on the same path marks it unread. For a personal notification it sets `isRead`/`readAt` on the notification (only its recipient may do this); for a broadcast it creates or removes that user's `notification-reads` row, so other users are not affected. It answers `{ id, isRead, readAt }`.

When a signed-in user finds notifications (REST, GraphQL, or the local API with `user`), `isRead`/`readAt` on broadcasts are filled in from that user's receipts. This happens after the query, so `where: { isRead: ... }` cannot filter broadcasts by a user's read state; query `notification-reads` for that.

## Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `channels` | `NotificationChannel[]` | built-in `default` channel | Channel definitions; each notification can be assigned one via its `channel` field |
| `webPush` | `object` | `undefined` | Web push credentials and behavior — see [WEBPUSH.md](./WEBPUSH.md) |
| `collectionOverrides` | `object` | `undefined` | Functions that receive and return the generated `notifications`/`pushSubscriptions`/`notificationReads` collection config, for customizing access control, fields, or hooks |

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

## Upgrade Notes

### Unreleased: `push-subscriptions` is always registered

The `push-subscriptions` collection used to be added only when `webPush.enabled` was true. It is now always added (see above), so after upgrading:

- **Postgres / SQLite:** if you never enabled web push, your database gains a new `push_subscriptions` table (plus one for its hasMany `channels` select). Create and run a migration (`payload migrate:create`, then `payload migrate`) before deploying, or let `push: true` create it in development.
- **MongoDB:** nothing to do; the collection is created on first write.
- **Types:** run `payload generate:types` once; `push-subscriptions` now appears in the generated types regardless of VAPID configuration.
- While web push is disabled, the collection is admin-only, so it adds no new access for regular users.

## License

MIT
