# Development app

A Next.js + Payload app for working on `@xtr-dev/payload-notifications`. It uses SQLite (`dev.db` in the repo root, or `DATABASE_URI`) and seeds itself on start.

## Run

```bash
pnpm install
cp dev/.env.example dev/.env   # optional: VAPID keys and secret
pnpm dev
```

- Admin: http://localhost:3000/admin, sign in as `dev@payloadcms.com` / `test` (admin). A second user, `customer@example.com` / `test`, has the `customer` role.
- Push demo: http://localhost:3000/demo

The seed creates a few notifications on the `general`, `orders` and `products` channels.

## Web push

Generate keys with `npx web-push generate-vapid-keys` and set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in `dev/.env`. The config enables `webPush` with `autoPush` and `notificationUrl`, so the default transformer's pushes link to the notification in the admin panel. The worker served at `/sw.js` is `dev/public/sw.js`, a local copy; the published one is generated from `serviceWorkerCode` in `src/exports/client.ts`.

To try it, open `/demo`, enable notifications, then create a notification in the admin with the subscribed user as recipient.

## Tests

`dev/int.spec.ts` runs with `pnpm test:int` against a scratch database (`dev/int-test.db`); `dev/e2e.spec.ts` runs with `pnpm test:e2e` (Playwright).
