# Payload Notifications Plugin - Development Environment

This is the development environment for testing and demonstrating the `@xtr-dev/payload-notifications` plugin.

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start the development server:**
   ```bash
   pnpm dev
   ```

3. **Open the demo:**
   - Homepage: [http://localhost:3000](http://localhost:3000)
   - Admin Panel: [http://localhost:3000/admin](http://localhost:3000/admin)
   - Push Demo: [http://localhost:3000/demo](http://localhost:3000/demo)

4. **Login to admin:**
   - Email: `dev@payloadcms.com`
   - Password: `test`

## 🔧 Configuration

The dev environment showcases a complete implementation of the notifications plugin with:

### Collections
- **Users** - Authentication with admin/customer roles
- **Products** - Sample e-commerce products
- **Orders** - Sample orders with different statuses
- **Posts** - Blog posts for content notifications
- **Notifications** - The plugin's notifications collection
- **Push Subscriptions** - Web push subscription management

### Plugin Configuration
```typescript
notificationsPlugin({
  collections: {
    slug: 'notifications',
    labels: { singular: 'Notification', plural: 'Notifications' }
  },
  relationships: [
    { name: 'order', relationTo: 'orders', label: 'Related Order' },
    { name: 'product', relationTo: 'products', label: 'Related Product', hasMany: true },
    { name: 'post', relationTo: 'posts', label: 'Related Post' }
  ],
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user?.role === 'admin'),
  },
  webPush: {
    enabled: true,
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
    vapidSubject: 'mailto:test@example.com'
  }
})
```

## 📱 Web Push Notifications

### Setup VAPID Keys

1. **Generate VAPID keys:**
   ```bash
   npx web-push generate-vapid-keys
   ```

2. **Create a `.env` file:**
   ```bash
   cp .env.example .env
   ```

3. **Add your VAPID keys to `.env`:**
   ```env
   VAPID_PUBLIC_KEY=your-public-key
   VAPID_PRIVATE_KEY=your-private-key
   ```

### API Endpoints

The plugin automatically creates these endpoints:

- `POST /api/push-notifications/subscribe` - Subscribe to push notifications
- `POST /api/push-notifications/unsubscribe` - Unsubscribe from push notifications
- `GET /api/push-notifications/vapid-public-key` - Get VAPID public key
- `POST /api/push-notifications/send` - Send notification to user
- `POST /api/push-notifications/test` - Send test notification (admin only)
- `POST /api/push-notifications/track` - Track notification events

### Service Worker Setup

The service worker is already configured and located at `/public/sw.js`. For new projects, generate it with:

```bash
npx @xtr-dev/payload-notifications generate-sw
```

The service worker handles:

- **Push message processing** - Receives and displays push notifications
- **Notification clicks** - Opens relevant admin panel or URLs
- **Test notifications** - Supports demo functionality
- **Analytics tracking** - Tracks notification interactions

### Testing Push Notifications

1. **Open the [demo page](http://localhost:3000/demo)**
2. **Enable notifications:**
   - Click "Enable Notifications" 
   - Allow browser permissions when prompted
   - The service worker will be registered automatically
3. **Test the system:**
   - Click "Send Test Notification" to see instant notifications
   - Check browser dev tools console for service worker logs
4. **Admin panel testing:**
   - Go to `/admin` and create notifications
   - Attach relationships to orders, products, or posts
   - Real push notifications require proper VAPID keys

### Service Worker Features

- ✅ **Automatic registration** when subscribing to notifications
- ✅ **Test notification support** for immediate testing
- ✅ **Rich notification display** with actions and custom icons
- ✅ **Click handling** that opens relevant admin pages
- ✅ **Analytics tracking** for notification interactions
- ✅ **Fallback handling** for missing icons or data

## 📊 Sample Data

The development environment is automatically seeded with:

### Users
- **Admin User**: dev@payloadcms.com (password: test)
- **Customer User**: customer@example.com (password: test)

### Products
- Wireless Headphones ($299.99)
- Cotton T-Shirt ($24.99)
- JavaScript Guide ($39.99)

### Orders
- Order #ORD-001 (Shipped - Headphones + T-Shirt)
- Order #ORD-002 (Pending - JavaScript Guide)

### Notifications
- Welcome notification with blog post attachment
- Order shipped notification with order and product attachments
- Product recommendation notification (marked as read)

## 🛠️ Development

### File Structure
```
dev/
├── app/
│   ├── (app)/
│   │   ├── page.tsx          # Homepage
│   │   └── demo/
│   │       └── page.tsx      # Push notifications demo
│   └── (payload)/
│       ├── admin/            # Payload admin panel
│       └── api/              # API routes
├── helpers/
│   ├── credentials.ts        # Default user credentials
│   └── testEmailAdapter.ts  # Email testing
├── payload.config.ts         # Payload configuration
├── seed.ts                   # Database seeding
└── .env.example             # Environment variables template
```

### Environment Variables
- `DATABASE_URI` - MongoDB connection string (optional, uses in-memory DB)
- `PAYLOAD_SECRET` - JWT secret for authentication
- `VAPID_PUBLIC_KEY` - VAPID public key for web push
- `VAPID_PRIVATE_KEY` - VAPID private key for web push
- `NODE_ENV` - Environment (development/production)

### Scripts
- `pnpm dev` - Start development server
- `pnpm build` - Build the application
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm test` - Run tests

## 🔍 Testing the Plugin

1. **Admin Panel Testing:**
   - Create notifications with different relationship attachments
   - Test read/unread functionality
   - View push subscriptions
   - Test user role permissions

2. **API Testing:**
   - Test push notification endpoints
   - Subscribe/unsubscribe from push notifications
   - Send test notifications

3. **Client Integration:**
   - Test the demo page functionality
   - Test push notification permissions
   - Test service worker integration

## 🚀 Production Deployment

1. Set up a real MongoDB database
2. Configure proper VAPID keys
3. Set up SSL certificates for push notifications
4. Configure proper environment variables
5. Deploy using your preferred platform

## 📚 Documentation

For complete documentation, see the main [README.md](../README.md) file.