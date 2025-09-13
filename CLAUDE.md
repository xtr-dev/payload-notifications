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
├── index.ts              # Main plugin export
├── types.ts              # TypeScript interfaces
├── collections/
│   └── notifications.ts  # Notifications collection schema
└── utils/
    └── buildFields.ts    # Dynamic field builder for relationships
```

## Development Guidelines

### Code Style
- Use TypeScript for all files
- Follow PayloadCMS plugin conventions
- Use descriptive variable and function names
- Add JSDoc comments for public APIs

### Plugin Configuration
The plugin accepts a configuration object with:
- `collections`: Collection settings (slug, labels)
- `relationships`: Array of relationship configurations
- `access`: Custom access control functions
- `fields`: Additional custom fields

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