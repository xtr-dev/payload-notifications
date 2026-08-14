# @xtr-dev/payload-notifications Development Guide

## Project Overview

This is a PayloadCMS plugin that adds a configurable notifications collection. The plugin allows developers to:
- Create notifications with titles and rich text messages
- Configure relationship attachments to any collection
- Track read/unread status
- Target specific recipients

## Architecture

### Plugin Structure
```
src/
├── index.ts                         # Plugin entry point and Payload config integration
├── types.ts                         # Public plugin option and web push types
├── collections/
│   ├── notifications.ts             # Notification schema and automatic push hook
│   └── push-subscriptions.ts        # Web push subscription schema
├── endpoints/
│   └── push-notifications.ts        # Subscribe, unsubscribe, and VAPID key endpoints
├── utils/
│   ├── richTextExtractor.ts         # Plain-text extraction and default push content
│   └── webPush.ts                   # Server-side subscription and delivery manager
└── exports/
    ├── client.ts                    # Browser push manager, service worker, and React hook exports
    └── rsc.ts                       # Server-only web push exports
```

`src/index.ts` always adds the notifications collection. When `webPush.enabled` is true, it also adds the push-subscriptions collection and push notification endpoints. The notifications collection can additionally send a push after creation when `webPush.autoPush` is true.

## Development Guidelines

### Code Style
- Use TypeScript for all files
- Follow PayloadCMS plugin conventions
- Use descriptive variable and function names
- Add JSDoc comments for public APIs

### Plugin Configuration
The plugin accepts a configuration object with:
- `channels` (required): An array of `{ id, name, description? }` channel definitions. These become the channel choices on notifications and push subscriptions. Calling `notificationsPlugin()` without options uses the built-in `default` channel.
- `webPush` (optional): Web push credentials and behavior. It requires `vapidPublicKey`, `vapidPrivateKey`, and `vapidSubject`; it can also set `enabled`, `autoPush`, request `options`, `transformNotification`, and `findSubscriptions`.
- `collectionOverrides` (optional): Functions that receive and return the generated `notifications` or `pushSubscriptions` `CollectionConfig`, allowing either collection schema to be customized.

### Relationship System
- Relationships are stored in an `attachments` group field
- Each relationship is dynamically generated based on config
- Supports single and multiple selections (`hasMany`)

### Collection Schema
The notifications collection includes:
- Required fields: title, message, recipient
- Optional fields: isRead, readAt, attachments
- Automatic timestamps: createdAt, updatedAt

## Testing Strategy
- Test with different PayloadCMS versions
- Verify relationship configurations work correctly
- Test access control functionality
- Ensure TypeScript types are accurate

## Build Process
- Use TypeScript compiler for builds
- Generate declaration files (.d.ts)
- Bundle for both CommonJS and ES modules
- Include source maps for debugging

## Plugin Registration
The plugin should be registered in PayloadCMS using the standard plugin pattern:
```typescript
export const notificationsPlugin = (options: NotificationsPluginOptions = {}) => {
  return (config: Config): Config => {
    // Plugin implementation
  }
}
```

## Key Implementation Notes
1. Use PayloadCMS field types and validation
2. Leverage PayloadCMS access control patterns
3. Generate relationship fields dynamically based on config
4. Provide sensible defaults for all configuration options
5. Ensure plugin doesn't conflict with existing collections
