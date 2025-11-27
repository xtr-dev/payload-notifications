# @xtr-dev/payload-notifications

[![npm version](https://badge.fury.io/js/@xtr-dev%2Fpayload-notifications.svg)](https://www.npmjs.com/package/@xtr-dev/payload-notifications)

A PayloadCMS plugin that adds a configurable notifications collection for sending messages with titles, content, and attachable relationship items.

⚠️ **Pre-release Warning**: This package is currently in active development (v0.0.x). Breaking changes may occur before v1.0.0. Not recommended for production use.

## Features

- 📧 Notifications collection with title and message fields
- 🔗 Configurable relationship attachments to any collection
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
  collections: {
    slug: 'notifications', // Default collection slug
  }
})
```

### Advanced Configuration with Relationships

```typescript
notificationsPlugin({
  collections: {
    slug: 'notifications',
    labels: {
      singular: 'Notification',
      plural: 'Notifications'
    }
  },
  relationships: [
    {
      name: 'order',
      relationTo: 'orders',
      label: 'Related Order'
    },
    {
      name: 'user',
      relationTo: 'users',
      label: 'Related User'
    },
    {
      name: 'product',
      relationTo: 'products',
      label: 'Related Product'
    }
  ],
  access: {
    // Custom access control functions
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user?.role === 'admin'),
    update: ({ req }) => Boolean(req.user?.role === 'admin'),
    delete: ({ req }) => Boolean(req.user?.role === 'admin'),
  },
  fields: [
    // Add custom fields to the notifications collection
  ]
})
```

> For web push notifications setup, see [WEBPUSH.md](./WEBPUSH.md)

## Collection Schema

The plugin creates a notifications collection with the following fields:

- **title** (required text): The notification title
- **message** (required richText): The notification content
- **recipient** (optional relationship): User who should receive the notification (optional if using custom recipient fields)
- **isRead** (checkbox): Read status tracking
- **readAt** (date): When the notification was read
- **attachments** (group): Configurable relationship fields
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
    attachments: {
      order: orderId,
      product: productId
    }
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
| `collections.slug` | `string` | `'notifications'` | Collection slug |
| `collections.labels` | `object` | `{ singular: 'Notification', plural: 'Notifications' }` | Collection labels |
| `relationships` | `array` | `[]` | Configurable relationship fields |
| `access` | `object` | Default access | Custom access control functions |
| `fields` | `array` | `[]` | Additional custom fields |

### Relationship Configuration

Each relationship in the `relationships` array supports:

```typescript
{
  name: string;        // Field name in attachments group
  relationTo: string;  // Target collection slug
  label?: string;      // Admin UI label
  required?: boolean;  // Whether field is required
  hasMany?: boolean;   // Allow multiple selections
}
```

## Examples

### E-commerce Notifications

```typescript
notificationsPlugin({
  relationships: [
    { name: 'order', relationTo: 'orders', label: 'Order' },
    { name: 'product', relationTo: 'products', label: 'Product', hasMany: true },
    { name: 'customer', relationTo: 'customers', label: 'Customer' }
  ]
})
```

### Content Management Notifications

```typescript
notificationsPlugin({
  relationships: [
    { name: 'post', relationTo: 'posts', label: 'Blog Post' },
    { name: 'page', relationTo: 'pages', label: 'Page' },
    { name: 'media', relationTo: 'media', label: 'Media', hasMany: true }
  ]
})
```

## Web Push Notifications

The plugin includes optional web push notifications support for PWA and mobile browser users. For complete setup instructions, configuration options, and usage examples, see [WEBPUSH.md](./WEBPUSH.md).

## TypeScript Support

The plugin includes full TypeScript support. Types are automatically generated based on your configuration.

## License

MIT
