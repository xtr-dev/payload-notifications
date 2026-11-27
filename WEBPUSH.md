# Web Push Notifications

Optional web push delivery for `@xtr-dev/payload-notifications`: browsers subscribe through the plugin's endpoints, and new notifications can be pushed to their recipients automatically.

## 1. VAPID keys

```bash
npx web-push generate-vapid-keys
```

Put both keys in your environment and keep the private key secret:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=... # same public key, for the browser
```

## 2. Plugin configuration

```typescript
import { notificationsPlugin } from '@xtr-dev/payload-notifications'

notificationsPlugin({
  channels: [{ id: 'default', name: 'Default' }],
  webPush: {
    enabled: true,
    autoPush: true,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY!,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY!,
    vapidSubject: 'mailto:you@example.com',
    notificationUrl: (notification) => `/notifications/${notification.id}`,
  },
})
```

| Option | Description |
|--------|-------------|
| `vapidPublicKey`, `vapidPrivateKey`, `vapidSubject` | Required. `vapidSubject` is a `mailto:` or `https:` contact |
| `enabled` | Registers the push endpoints and allows sending. Without it nothing is sent and `push-subscriptions` is admin-only |
| `autoPush` | Sends a push when a notification is created (see [Automatic pushes](#automatic-pushes)) |
| `notificationUrl` | Where a click opens, for the default transformer. A string or `(notification) => string`; default `/` |
| `transformNotification` | `(notification) => PushNotificationContent`. Replaces the default transformer, so `notificationUrl` no longer applies |
| `findSubscriptions` | `(notification, payload) => Promise<subscription[]>`. Replaces the default recipient lookup |
| `options` | `web-push` `RequestOptions` (TTL, urgency, proxy, ...) |

The default transformer sends the title, a plain-text excerpt of the message (up to 120 characters, Lexical and Slate supported), `data: { id, notificationId, url, createdAt, trackClose: true }` and `tag: notification-<id>`. It sets no icon, badge or actions, because the package ships no images.

A custom transformer:

```typescript
transformNotification: (notification) => ({
  title: notification.title,
  body: 'You have a new notification',
  icon: '/icons/icon-192.png',
  data: { url: `/notifications/${notification.id}`, id: notification.id, trackClose: true },
  actions: [{ action: 'view', title: 'View' }, { action: 'dismiss', title: 'Dismiss' }],
}),
```

The service worker handles the `view` and `dismiss` actions; `data.url` is opened on click, and `data.trackClose` with `data.id` reports a close to `/track`.

## Automatic pushes

With `autoPush`, each newly created notification is pushed:

- **Default:** to the active subscriptions of its `recipient` that include the notification's `channel` (all of the recipient's subscriptions when the notification has no channel). A notification without a recipient, such as a broadcast, is **not** pushed unless you set `findSubscriptions`. A recipient who opted out of the notification's channel ([channel subscriptions](./README.md#channel-subscriptions)) gets no push, whatever their devices' `channels` say.
- **With `findSubscriptions`:** to the subscription documents it returns. Channel opt-outs are not applied for you here; check `isSubscribedToChannel` from the main entry if they should be.

Failures are logged and never fail the create. Subscriptions that answer 404 or 410 are marked `isActive: false`.

Example: push personal notifications to their recipient and broadcasts to every subscriber, filtered by channel.

```typescript
import type { Where } from 'payload'

findSubscriptions: async (notification, payload) => {
  const where: Where = { isActive: { equals: true } }
  if (notification.audience === 'user') where.user = { equals: notification.recipient }
  if (notification.channel) where.channels = { contains: notification.channel }
  const { docs } = await payload.find({ collection: 'push-subscriptions', where, limit: 0 })
  return docs
},
```

For custom recipient fields (for example a `recipientEmail` added through `collectionOverrides.notifications`), look up the matching users and return their subscriptions. A notification created without a `recipient` is a broadcast that every signed-in user can read, so set `audience: 'user'` on such notifications to keep them admin-only in the API.

## 3. Service worker

The package ships a classic (non-module) service worker at `@xtr-dev/payload-notifications/sw.js`. Serve it from your site root, for example by copying it into `public/` in a build step:

```js
// scripts/copy-sw.mjs
import { copyFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
copyFileSync(require.resolve('@xtr-dev/payload-notifications/sw.js'), 'public/sw.js')
```

The same code is exported as the `serviceWorkerCode` string from `/client`. The worker shows pushes, opens `data.url` on click (focusing an open tab with that URL), and posts closes to `/api/push-notifications/track` when `data.trackClose` is set; that request is authenticated by the user's same-origin auth cookie.

### Icon and badge

The worker uses the `icon` and `badge` from the push payload. Defaults for pushes without them can be set with query parameters on the registration URL:

```typescript
new ClientPushManager(vapidPublicKey, {
  serviceWorkerPath: '/sw.js?icon=/icons/icon-192.png&badge=/icons/badge-72.png',
})
```

## 4. Subscribing in the browser

Users must be signed in to subscribe; a subscription belongs to the user that created it.

```tsx
'use client'
import { usePushNotifications } from '@xtr-dev/payload-notifications/client'

export function NotificationSettings() {
  const { isSupported, isSubscribed, permission, subscribe, unsubscribe } =
    usePushNotifications(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, ['default'])

  if (!isSupported) return <p>Push notifications are not supported</p>
  return isSubscribed
    ? <button onClick={unsubscribe}>Disable notifications</button>
    : <button disabled={permission === 'denied'} onClick={subscribe}>Enable notifications</button>
}
```

Without React, use `ClientPushManager` directly:

```typescript
import { ClientPushManager } from '@xtr-dev/payload-notifications/client'

const push = new ClientPushManager(vapidPublicKey, {
  serviceWorkerPath: '/sw.js', // default
  apiEndpoint: '/api/push-notifications', // default
})
await push.subscribe(['default']) // channel ids from the plugin config
await push.isSubscribed()
await push.unsubscribe()
```

The public key is also available from `GET /api/push-notifications/vapid-public-key`.

## Sending from server code

```typescript
import { WebPushManager } from '@xtr-dev/payload-notifications/rsc'

const push = new WebPushManager(webPushConfig, payload)
await push.sendToRecipient(userId, 'Order shipped', 'Your order #12345 is on its way', {
  channel: 'orders',
  data: { url: '/orders/12345' },
})
```

`sendToRecipient` returns one `{ success, error? }` per subscription. `sendToUser` is a deprecated alias.

## Endpoints

Registered only when `webPush.enabled` is true. There is no HTTP endpoint for sending pushes.

| Endpoint | Auth | Body |
|----------|------|------|
| `POST /api/push-notifications/subscribe` | required | `{ subscription, userAgent, channels }`. 403 if the endpoint belongs to another user |
| `POST /api/push-notifications/unsubscribe` | required | `{ endpoint }`; marks the user's own matching subscription inactive |
| `GET /api/push-notifications/vapid-public-key` | none | answers `{ publicKey }` |
| `POST /api/push-notifications/track` | required | `{ action, notificationId?, timestamp? }`; validated and logged, 400 on invalid input |
