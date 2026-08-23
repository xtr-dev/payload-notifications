# Web Push Notifications

The `@xtr-dev/payload-notifications` plugin includes built-in support for web push notifications for PWA and mobile browser users.

## Features

- 🔔 Web Push Notifications for mobile PWA support
- 📲 Service Worker integration for offline notifications
- 🔐 VAPID keys support for secure push messaging
- 🎯 Auto-push on notification creation
- 🔄 Custom notification transformers
- 👤 Anonymous user notification support

## Setup VAPID Keys

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

## Plugin Configuration

### Basic Web Push Setup

```typescript
import { notificationsPlugin } from '@xtr-dev/payload-notifications'

notificationsPlugin({
  webPush: {
    enabled: true,
    autoPush: true, // Automatically send push notifications when notifications are created
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
    vapidSubject: 'mailto:your-email@example.com',
  }
})
```

### Advanced Configuration

```typescript
notificationsPlugin({
  webPush: {
    enabled: true,
    autoPush: true,
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

## Anonymous Notifications Support

For scenarios where you need to send notifications to anonymous users or have custom recipient logic (e.g., notifications based on email addresses, phone numbers, or custom identifiers), you can use the `findSubscriptions` hook combined with a custom field added via `collectionOverrides`.

### Example: Email-based notifications

```typescript
notificationsPlugin({
  channels: [{ id: 'default', name: 'Default' }],
  // Add custom email field to the notifications collection
  collectionOverrides: {
    notifications: (config) => ({
      ...config,
      fields: [
        ...config.fields,
        {
          name: 'recipientEmail',
          type: 'email',
          label: 'Recipient Email',
          admin: {
            description: 'Email address of the notification recipient',
          },
        }
      ]
    })
  },
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

### Example: Phone number-based notifications

```typescript
notificationsPlugin({
  channels: [{ id: 'default', name: 'Default' }],
  collectionOverrides: {
    notifications: (config) => ({
      ...config,
      fields: [
        ...config.fields,
        {
          name: 'recipientPhone',
          type: 'text',
          label: 'Recipient Phone',
          admin: {
            description: 'Phone number of the notification recipient',
          },
        }
      ]
    })
  },
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
- Add custom recipient fields via `collectionOverrides.notifications` for your specific use case
- Use the `findSubscriptions` hook to implement custom subscription lookup logic
- The hook receives the full notification document and payload instance
- Return an array of push subscription documents that should receive the notification
- The plugin will handle the actual push notification sending and error handling

## Client-Side Integration

⚠️ **Authentication Required:** Users must be signed in to subscribe to push notifications. Push subscriptions are associated with user accounts.

### React Hook

```typescript
import { usePushNotifications } from '@xtr-dev/payload-notifications/client'

function NotificationSettings() {
  const {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe
  } = usePushNotifications(process.env.NEXT_PUBLIC_VAPID_KEY, ['default'])

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
```

### Vanilla JavaScript

```typescript
import { ClientPushManager } from '@xtr-dev/payload-notifications/client'

const pushManager = new ClientPushManager('your-vapid-public-key')

// Subscribe to notifications (channel ids must match the plugin's configured channels)
await pushManager.subscribe(['default'])

// Check subscription status
const isSubscribed = await pushManager.isSubscribed()

// Unsubscribe
await pushManager.unsubscribe()
```

## Service Worker Setup

The package has no CLI — write the exported service worker template to a file yourself. `serviceWorkerCode` is a string export from `/client` containing the complete template:

```typescript
// scripts/generate-sw.ts
import { writeFileSync } from 'fs'
import { serviceWorkerCode } from '@xtr-dev/payload-notifications/client'

writeFileSync('public/sw.js', serviceWorkerCode)
```

Run it with `tsx scripts/generate-sw.ts` (or any TypeScript runner) whenever the template changes. The generated file handles:

- Push notification events
- Notification click handling
- Service worker lifecycle management
- Error handling and fallbacks
- Notification close tracking (fetches `/api/push-notifications/track`, which this plugin does not implement — remove that handler or implement the route yourself if you don't want a 404 on every dismissal)

**Important Notes:**
- The service worker file **must** be placed at `/public/sw.js` in Next.js projects
- This makes it accessible at `https://yourdomain.com/sw.js`
- Service workers must be served from the root domain for security
- After creating the file, restart your Next.js development server

## Server-Side Push Notifications

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

## API Endpoints

The plugin automatically creates these endpoints when web push is enabled:

- `POST /api/push-notifications/subscribe` - Subscribe to push notifications ⚠️ **Requires authentication**
- `POST /api/push-notifications/unsubscribe` - Unsubscribe from push notifications
- `GET /api/push-notifications/vapid-public-key` - Get VAPID public key

There are no `/send`, `/test`, or `/track` routes. Sending is done server-side by calling `WebPushManager` directly (see above), either from the `autoPush` hook or your own code — there is no HTTP endpoint for it.

## Integration with Notifications Collection

When creating notifications, you can automatically send push notifications:

```typescript
// Create notification and send push notification
const notification = await payload.create({
  collection: 'notifications',
  data: {
    title: 'New Message',
    message: [{ children: [{ text: 'You have a new message!' }] }],
    recipient: userId,
    channel: 'default'
  }
})

// With autoPush enabled, push notifications are sent automatically
// Or manually send push notification
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
