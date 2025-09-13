# @xtr-dev/payload-notifications

A PayloadCMS plugin that adds a configurable notifications collection for sending messages with titles, content, and attachable relationship items.

⚠️ **Pre-release Warning**: This package is currently in active development (v0.0.x). Breaking changes may occur before v1.0.0. Not recommended for production use.

## Features

- 📧 Notifications collection with title and message fields
- 🔗 Configurable relationship attachments to any collection
- 📱 Built-in read/unread status tracking  
- 🎯 Recipient targeting support
- ⚙️ Flexible plugin configuration
- 📅 Automatic timestamp tracking
- 🔔 **Web Push Notifications** for mobile PWA support
- 📲 Service Worker integration for offline notifications
- 🔐 VAPID keys support for secure push messaging

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

### Advanced Configuration with Relationships and Web Push

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
  webPush: {
    enabled: true,
    autoPush: true, // Automatically send push notifications when notifications are created
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
    vapidSubject: 'mailto:your-email@example.com',
    // Optional: Custom notification transformer
    transformNotification: (notification) => ({
      title: `🔔 ${notification.title}`,
      body: extractTextFromRichText(notification.message).substring(0, 120) + '...',
      icon: '/icons/notification-icon.png',
      badge: '/icons/notification-badge.png',
      data: {
        notificationId: notification.id,
        url: `/admin/collections/notifications/${notification.id}`
      },
      actions: [
        { action: 'view', title: 'View', icon: '/icons/view.png' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    }),
    // Optional: Custom hook for finding push subscriptions (for anonymous notifications)
    findSubscriptions: async (notification, payload) => {
      // Custom logic to find subscriptions based on notification data
      // Return array of push subscription documents
      return []
    }
  }
})
```

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

The plugin supports web push notifications for PWA and mobile browser users.

### Anonymous Notifications Support

For scenarios where you need to send notifications to anonymous users or have custom recipient logic (e.g., notifications based on email addresses, phone numbers, or custom identifiers), you can use the `findSubscriptions` hook combined with custom fields.

**Example: Email-based notifications**

```typescript
notificationsPlugin({
  // Add custom email field to notifications collection
  fields: [
    {
      name: 'recipientEmail',
      type: 'email',
      label: 'Recipient Email',
      admin: {
        description: 'Email address of the notification recipient',
      },
    }
  ],
  webPush: {
    enabled: true,
    autoPush: true,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
    vapidSubject: 'mailto:your-email@example.com',
    // Custom hook to find subscriptions based on email
    findSubscriptions: async (notification, payload) => {
      if (!notification.recipientEmail) return []
      
      // Find push subscriptions associated with this email
      const subscriptions = await payload.find({
        collection: 'push-subscriptions',
        where: {
          and: [
            { recipientEmail: { equals: notification.recipientEmail } },
            { isActive: { equals: true } },
            // Channel filtering (if specified)
            ...(notification.channel ? [{
              or: [
                { channels: { contains: notification.channel } },
                { channels: { contains: 'all' } },
                { channels: { exists: false } },
              ]
            }] : [])
          ]
        }
      })
      
      return subscriptions.docs
    }
  }
})
```

**Example: Phone number-based notifications**

```typescript
notificationsPlugin({
  fields: [
    {
      name: 'recipientPhone',
      type: 'text',
      label: 'Recipient Phone',
      admin: {
        description: 'Phone number of the notification recipient',
      },
    }
  ],
  webPush: {
    enabled: true,
    autoPush: true,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
    vapidSubject: 'mailto:your-email@example.com',
    findSubscriptions: async (notification, payload) => {
      if (!notification.recipientPhone) return []
      
      // Custom logic to find subscriptions by phone number
      // You might have a separate mapping table or user lookup
      const user = await payload.find({
        collection: 'users',
        where: { phone: { equals: notification.recipientPhone } },
        limit: 1
      })
      
      if (!user.docs[0]) return []
      
      const subscriptions = await payload.find({
        collection: 'push-subscriptions',
        where: {
          and: [
            { user: { equals: user.docs[0].id } },
            { isActive: { equals: true } }
          ]
        }
      })
      
      return subscriptions.docs
    }
  }
})
```

**Key Points:**
- The default `recipient` field remains a user relationship for standard notifications
- Add custom recipient fields via the `fields` option for your specific use case  
- Use the `findSubscriptions` hook to implement custom subscription lookup logic
- The hook receives the full notification document and payload instance
- Return an array of push subscription documents that should receive the notification
- The plugin will handle the actual push notification sending and error handling

### Setup VAPID Keys

**Step 1:** Generate VAPID keys for secure push messaging:

```bash
npx web-push generate-vapid-keys
```

This will output something like:
```
=======================================
Public Key:
BNde-uFUkQB5BweFbOt_40Tn3xZahMop2JKT8kqRn4UqMMinieguHmVCTxwN_qfM-jZ0YFpVpIk3CWehlXcTl8A

Private Key:
RVtnLcW8qlSkuhNskz8lwBwYcam78x-zO0Ssm_P2bmE
=======================================
```

**Step 2:** Add the keys to your environment variables:

```env
VAPID_PUBLIC_KEY=BNde-uFUkQB5BweFbOt_40Tn3xZahMop2JKT8kqRn4UqMMinieguHmVCTxwN_qfM-jZ0YFpVpIk3CWehlXcTl8A
VAPID_PRIVATE_KEY=RVtnLcW8qlSkuhNskz8lwBwYcam78x-zO0Ssm_P2bmE
```

**Step 3:** Restart your application to load the new environment variables.

⚠️ **Important:** Keep your private key secure and never commit it to version control!

### Client-Side Integration

⚠️ **Authentication Required:** Users must be signed in to subscribe to push notifications. Push subscriptions are associated with user accounts.

```typescript
import { ClientPushManager, usePushNotifications } from '@xtr-dev/payload-notifications/client'

// React Hook (if using React)
function NotificationSettings() {
  const { 
    isSupported, 
    isSubscribed, 
    permission, 
    subscribe, 
    unsubscribe 
  } = usePushNotifications(process.env.NEXT_PUBLIC_VAPID_KEY)

  if (!isSupported) return <div>Push notifications not supported</div>

  return (
    <div>
      <p>Status: {isSubscribed ? 'Subscribed' : 'Not subscribed'}</p>
      <p>Permission: {permission}</p>
      
      {!isSubscribed ? (
        <button onClick={subscribe}>Enable Notifications</button>
      ) : (
        <button onClick={unsubscribe}>Disable Notifications</button>
      )}
    </div>
  )
}

// Vanilla JavaScript
const pushManager = new ClientPushManager('your-vapid-public-key')

// Subscribe to notifications
await pushManager.subscribe()

// Check subscription status
const isSubscribed = await pushManager.isSubscribed()
```

### Service Worker Setup

Generate a service worker file automatically:

```bash
npx @xtr-dev/payload-notifications generate-sw
```

This will create a `/public/sw.js` file with the complete service worker template that handles:

- Push notification events
- Notification click handling
- Service worker lifecycle management
- Error handling and fallbacks
- Notification tracking and analytics

**Important Notes:**
- The service worker file **must** be placed at `/public/sw.js` in Next.js projects
- This makes it accessible at `https://yourdomain.com/sw.js`
- Service workers must be served from the root domain for security
- After creating the file, restart your Next.js development server

### Server-Side Push Notifications

```typescript
import { WebPushManager } from '@xtr-dev/payload-notifications/rsc'

// Send push notification to a user
const pushManager = new WebPushManager(webPushConfig, payload)

await pushManager.sendToUser(
  userId,
  'Order Shipped!',
  'Your order #12345 has been shipped',
  {
    icon: '/icons/order-shipped.png',
    badge: '/icons/badge.png',
    data: { orderId: '12345', url: '/orders/12345' },
    actions: [
      { action: 'view', title: 'View Order', icon: '/icons/view.png' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  }
)
```

### API Endpoints

The plugin automatically creates these endpoints when web push is enabled:

- `POST /api/push-notifications/subscribe` - Subscribe to push notifications ⚠️ **Requires authentication**
- `POST /api/push-notifications/unsubscribe` - Unsubscribe from push notifications
- `GET /api/push-notifications/vapid-public-key` - Get VAPID public key
- `POST /api/push-notifications/send` - Send notification to user ⚠️ **Requires authentication**
- `POST /api/push-notifications/test` - Send test notification ⚠️ **Admin only**
- `POST /api/push-notifications/track` - Track notification events

### Integration with Notifications Collection

When creating notifications, you can automatically send push notifications:

```typescript
// Create notification and send push notification
const notification = await payload.create({
  collection: 'notifications',
  data: {
    title: 'New Message',
    message: [{ children: [{ text: 'You have a new message!' }] }],
    recipient: userId,
    attachments: { message: messageId }
  }
})

// Send push notification
if (webPushEnabled) {
  await pushManager.sendToUser(
    userId,
    notification.title,
    'You have a new notification',
    {
      data: { 
        notificationId: notification.id,
        url: `/notifications/${notification.id}`
      }
    }
  )
}
```

## TypeScript Support

The plugin includes full TypeScript support. Types are automatically generated based on your configuration.

## License

MIT
