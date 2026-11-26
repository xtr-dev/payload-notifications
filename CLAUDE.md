# @xtr-dev/payload-notifications

Payload 3 plugin: a `notifications` collection (personal and broadcast, channels, per-user read state) plus optional web push. User docs are in README.md and WEBPUSH.md; keep them in sync with behaviour changes.

## Commands

```sh
pnpm install
pnpm dev                     # dev app in dev/ (Next + SQLite at ./dev.db), admin dev@payloadcms.com / test
pnpm lint                    # eslint
pnpm test:int                # all vitest suites: dev/int.spec.ts and src/**/*.spec.ts
pnpm test:unit               # src/**/*.spec.ts only
pnpm build                   # tsc types + swc + dist/sw.js
pnpm test:published-exports  # imports dist entry points, checks dist/sw.js (needs build)
pnpm test:declarations       # NodeNext consumer type-check of dist (needs build)
pnpm dev:generate-types      # regenerate dev/payload-types.ts
```

## Architecture

```
src/
├── index.ts                      # plugin: adds collections, users beforeDelete cleanup, push endpoints
├── types.ts                      # NotificationsPluginOptions, WebPushConfig, PushNotificationContent
├── collections/
│   ├── notifications.ts          # schema, access, autoPush afterChange hook
│   ├── notification-audience.ts  # audience derivation, broadcast read state, POST/DELETE /:id/read
│   ├── notification-reads.ts     # per-user broadcast read receipts
│   └── push-subscriptions.ts     # subscription schema and owner-scoped access
├── endpoints/push-notifications.ts  # subscribe, unsubscribe, vapid-public-key, track
├── utils/richTextExtractor.ts    # Lexical/Slate plain text, default push transformer
├── utils/webPush.ts              # WebPushManager (server-side send/subscribe)
├── client/push-manager.ts        # ClientPushManager (browser)
└── exports/client.ts, rsc.ts     # /client and /rsc entry points; client.ts holds serviceWorkerCode
```

- All three collections are always registered so types and schema don't depend on VAPID keys; endpoints and sending are gated on `webPush.enabled`, auto pushes on `webPush.autoPush`.
- `audience` (`user` | `broadcast`) decides visibility. Never treat an empty recipient as a broadcast: SQL adapters null the recipient when the user is deleted.
- Admin is `user.role === 'admin'`. Members may only update `isRead`/`readAt` on their own personal notifications; broadcast reads go through `notification-reads`.
- `exports` in package.json point at `src/` for development; `publishConfig.exports` point at `dist/` and add `./sw.js`. Keep both in sync when adding entry points.
- The service worker (`serviceWorkerCode`) must stay a classic plain-JS script: no `import`/`export`, no TypeScript. `build:sw` writes it to `dist/sw.js` and fails otherwise.
- ESM only; use `.js` extensions in relative imports (checked by `test:declarations`).

## Conventions

- PR titles are conventional commits (`fix(push): ...`, `feat!: ...` for breaking). Breaking changes need a migration note in the PR body and README "Upgrade notes".
- Never bump `package.json` versions in PRs. Releases run manually via the Release workflow (`.github/workflows/release.yml`, xtr-dev/changelog), which derives the version and CHANGELOG.md from commits.
- Add tests for behaviour changes: unit specs next to the source, integration in `dev/int.spec.ts`.
