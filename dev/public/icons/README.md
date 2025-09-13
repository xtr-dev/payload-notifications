# Notification Icons

This directory contains icons for web push notifications.

## Required Icons:

- `notification-icon.png` - Main notification icon (recommended: 192x192px)
- `notification-badge.png` - Small badge icon (recommended: 72x72px)
- `view.png` - View action icon (recommended: 32x32px)
- `dismiss.png` - Dismiss action icon (recommended: 32x32px)

## Icon Requirements:

1. **Format**: PNG with transparency support
2. **Size**: Multiple sizes recommended (72x72, 96x96, 128x128, 192x192, 256x256, 512x512)
3. **Design**: Simple, clear, recognizable at small sizes
4. **Background**: Transparent or solid color that works on any background

## Fallback:

If custom icons are not provided, the service worker will use these default paths:
- `/icons/notification-icon.png`
- `/icons/notification-badge.png`
- `/icons/view.png`
- `/icons/dismiss.png`

You can create simple colored PNG files or use emoji-based icons for testing.