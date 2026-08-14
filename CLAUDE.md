# @xtr-dev/payload-notifications Development Guide

## Project Overview

This is a PayloadCMS plugin that adds a configurable notifications collection. The plugin allows developers to:
- Create notifications with titles and rich text messages
- Configure notification channels
- Track read/unread status
- Target specific recipients
- Optionally deliver web push notifications

## Architecture

### Plugin Structure
```
src/
├── index.ts              # Main plugin export
├── types.ts              # TypeScript interfaces
├── collections/
│   ├── notifications.ts       # Notifications collection schema
│   └── push-subscriptions.ts  # Web push subscription schema
├── endpoints/            # Web push endpoints
└── utils/                # Web push and rich-text helpers
```

## Development Guidelines

### Code Style
- Use TypeScript for all files
- Follow PayloadCMS plugin conventions
- Use descriptive variable and function names
- Add JSDoc comments for public APIs

### Plugin Configuration
The plugin accepts a configuration object with:
- `channels`: Required, non-empty array of notification channels
- `collectionOverrides`: Optional functions for customizing generated collection configs
- `webPush`: Optional web push configuration

Calling `notificationsPlugin()` without an options object uses the built-in default channel.

### Collection Schema
The notifications collection includes:
- Required fields: title, message
- Optional fields: recipient, channel, isRead, readAt
- Automatic timestamps: createdAt, updatedAt

## Testing Strategy
- Test with different PayloadCMS versions
- Verify channel configuration and collection overrides
- Test web push enabled and disabled paths
- Ensure TypeScript types are accurate

## Build Process
- Use TypeScript compiler for builds
- Generate declaration files (.d.ts)
- Bundle for both CommonJS and ES modules
- Include source maps for debugging

## Plugin Registration
The plugin should be registered in PayloadCMS using the standard plugin pattern:
```typescript
export const notificationsPlugin = (options?: NotificationsPluginOptions) => {
  return (config: Config): Config => {
    // Plugin implementation
  }
}
```

## Key Implementation Notes
1. Use PayloadCMS field types and validation
2. Preserve generated fields, hooks, and access rules in collection overrides unless intentionally replacing them
3. Keep `channels` non-empty whenever an options object is supplied
4. Gate both push subscriptions and push endpoints on `webPush.enabled`
5. Ensure the plugin doesn't conflict with existing collections or endpoints
