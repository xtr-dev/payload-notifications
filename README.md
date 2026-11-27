# @xtr-dev/payload-notifications

[![npm version](https://badge.fury.io/js/@xtr-dev%2Fpayload-notifications.svg)](https://www.npmjs.com/package/@xtr-dev/payload-notifications)

A PayloadCMS plugin that adds a notifications collection with titles, rich text messages, channels, personal and broadcast audiences, and per-user read state. Web push delivery is optional (see [WEBPUSH.md](./WEBPUSH.md)).

**v0.x** — minor versions may contain breaking changes until 1.0.

## Installation

```bash
pnpm add @xtr-dev/payload-notifications
```

Requires `payload` `^3.37.0` and `react` `^18.2.0 || ^19.0.0`. The plugin expects a `users` collection; users with `role === 'admin'` get full access.

## Usage

```typescript
import { buildConfig } from 'payload'
import { notificationsPlugin } from '@xtr-dev/payload-notifications'

export default buildConfig({
  plugins: [
    notificationsPlugin({
      channels: [
        { id: 'orders', name: 'Order Updates', description: 'Order status and shipping' },
        { id: 'marketing', name: 'Marketing' },
      ],
    }),
  ],
})
```

Called without options, `notificationsPlugin()` uses a single built-in `default` channel. Passing an empty `channels` array throws.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `channels` | `NotificationChannel[]` (`{ id, name, description? }`) | one `default` channel | Choices for a notification's `channel` and a push subscription's `channels` |
| `webPush` | `WebPushConfig` | `undefined` | VAPID keys and push behaviour, see [WEBPUSH.md](./WEBPUSH.md) |
| `collectionOverrides` | `{ notifications?, pushSubscriptions?, notificationReads? }` | `undefined` | Functions that receive and return each generated `CollectionConfig` |

## Collections

### `notifications`

The slug is fixed.

| Field | Type | Notes |
|-------|------|-------|
| `title` | text, required | |
| `message` | richText, required | Lexical (or any rich text editor); the default push body is a plain-text excerpt |
| `recipient` | relationship to `users` | Optional |
| `audience` | select: `user` \| `broadcast` | Left out on create, it is `broadcast` without a recipient and `user` with one. A broadcast cannot have a recipient |
| `channel` | select | One of the configured channel ids |
| `isRead` / `readAt` | checkbox / date | For broadcasts, reads by a signed-in user return that user's own read state |

Timestamps are on.

### `notification-reads`

One row per user and broadcast they have read, since a broadcast is a single row shared by every user. Users can read and delete their own rows and create rows only for themselves and broadcasts they can see; the read endpoints below do this for them.

### `push-subscriptions`

Always registered, even without web push, so generated types and the database schema do not depend on VAPID keys. Without `webPush.enabled` it stays empty and only admins can access it. See [WEBPUSH.md](./WEBPUSH.md).

### Default access

| Operation | Admins (`role === 'admin'`) | Other signed-in users |
|-----------|-----------------------------|-----------------------|
| read | all | their own (`recipient` is them) and broadcasts |
| create, delete | yes | no |
| update | all fields | `isRead`/`readAt` of their own personal notifications |

Anonymous requests get nothing. The local API bypasses access control by default, so server code can create notifications freely. A personal notification whose recipient no longer exists stays `audience: 'user'` and is visible only to admins; an empty recipient is never treated as a broadcast.

Deleting a user through Payload also deletes their personal notifications, read receipts and push subscriptions. Deleting a notification deletes its read receipts.

## Creating and reading notifications

```typescript
// Personal notification
await payload.create({
  collection: 'notifications',
  data: {
    title: 'Order shipped',
    message: {
      root: {
        type: 'root',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Your order is on its way.' }] }],
      },
    },
    recipient: userId,
    channel: 'orders',
  },
})

// What a user can see, with broadcast read state filled in for them
const { docs } = await payload.find({
  collection: 'notifications',
  overrideAccess: false,
  user,
  sort: '-createdAt',
})
```

### Read state endpoints

- `POST /api/notifications/:id/read` marks a notification read for the signed-in user.
- `DELETE /api/notifications/:id/read` marks it unread.

Both answer `{ id, isRead, readAt }`. For a personal notification they set `isRead`/`readAt` on the notification (only its recipient may); for a broadcast they create or remove that user's `notification-reads` row, so other users are unaffected. Members cannot `PATCH` a broadcast.

When a signed-in user finds notifications (REST, GraphQL, or the local API with `user`), `isRead`/`readAt` on broadcasts are filled in from that user's receipts after the query. So `where: { isRead: ... }` filters broadcasts on the stored flag, not the user's state; query `notification-reads` for that.

## Customizing collections

Spread the existing config and hooks so the plugin's own behaviour (audience derivation, read state, auto push) stays in place. Example: send an email when a notification is created.

```typescript
notificationsPlugin({
  channels: [{ id: 'default', name: 'Default' }],
  collectionOverrides: {
    notifications: (config) => ({
      ...config,
      hooks: {
        ...config.hooks,
        afterChange: [
          ...(config.hooks?.afterChange ?? []),
          async ({ doc, operation, req }) => {
            if (operation !== 'create' || !doc.recipient) return
            const id = typeof doc.recipient === 'object' ? doc.recipient.id : doc.recipient
            const user = await req.payload.findByID({ collection: 'users', id, req })
            // Don't throw here, or the notification create fails with the email
            await sendEmail({ to: user.email, subject: doc.title }).catch((err) => req.payload.logger.error(err))
          },
        ],
      },
    }),
  },
})
```

Fields added this way have no field-level `access`, so members who can update their own notifications can also update those fields. Add `access: { update: ... }` to them if that matters.

## Exports

| Path | Exports |
|------|---------|
| `@xtr-dev/payload-notifications` | `notificationsPlugin` (also default), types `NotificationsPluginOptions`, `NotificationChannel`, `NotificationAudience`, `PushNotificationContent`, `WebPushConfig` |
| `@xtr-dev/payload-notifications/client` | `ClientPushManager`, `usePushNotifications`, `serviceWorkerCode`, type `PushSubscriptionData` |
| `@xtr-dev/payload-notifications/rsc` | `WebPushManager`, `createPushNotificationEndpoints`, `createPushSubscriptionsCollection`, types `WebPushConfig`, `PushSubscription`, `NotificationsPluginOptions` |
| `@xtr-dev/payload-notifications/sw.js` | The ready-to-serve service worker file |

## Upgrade notes

### 0.2.0

- **Schema:** `notifications` gains an `audience` column and there is a new `notification-reads` collection. On Postgres/SQLite, create and run a migration (`payload migrate:create`, then `payload migrate`). Run `payload generate:types`.
- **Backfill `audience`:** rows with an empty `audience` are visible only to admins. Review rows without a recipient first (some may belong to users who were already deleted), then:
  ```sql
  UPDATE notifications SET audience = 'user' WHERE recipient_id IS NOT NULL;
  UPDATE notifications SET audience = 'broadcast' WHERE recipient_id IS NULL AND audience IS NULL;
  ```
  On MongoDB use the equivalent `updateMany` calls.
- **Stricter access:** members can no longer create notifications, read other users' notifications, or update broadcasts. Use `POST /api/notifications/:id/read` instead of `PATCH` to mark notifications read. To keep the old behaviour, override `access` via `collectionOverrides.notifications`.
- **Notifications targeted through `findSubscriptions`** without a recipient are created as broadcasts. Pass `audience: 'user'` to make them admin-only.
- **Push:** default pushes now link to `webPush.notificationUrl` (default `/`) and set no icon, badge or actions. See [WEBPUSH.md](./WEBPUSH.md#icon-and-badge).

### 0.1.0

- `push-subscriptions` is always registered. On Postgres/SQLite, if you never enabled web push, migrate to create its tables. It is admin-only while web push is disabled.
- Members may only update `isRead`/`readAt` of their own notifications.

## License

MIT
