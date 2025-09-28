import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import {testEmailAdapter} from "./helpers/testEmailAdapter"
import {seed} from "./seed"
import { notificationsPlugin } from '@xtr-dev/payload-notifications'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

const buildConfigWithMemoryDB = async () => {
  if (!process.env.DATABASE_URI) {
    // Use a simple memory server instead of replica set for better stability
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    const memoryDB = await MongoMemoryServer.create({
      instance: {
        dbName: 'payloadmemory',
      },
    })

    process.env.DATABASE_URI = memoryDB.getUri()
  }

  return buildConfig({
    admin: {
      importMap: {
        baseDir: path.resolve(dirname),
      },
    },
    collections: [
      // Users collection with roles for authentication
      {
        slug: 'users',
        auth: true,
        admin: {
          useAsTitle: 'email',
        },
        fields: [
          {
            name: 'role',
            type: 'select',
            options: [
              { label: 'Admin', value: 'admin' },
              { label: 'Customer', value: 'customer' },
            ],
            defaultValue: 'customer',
            required: true,
          },
          {
            name: 'firstName',
            type: 'text',
            label: 'First Name',
          },
          {
            name: 'lastName',
            type: 'text',
            label: 'Last Name',
          },
        ],
      },
    ],
    db: mongooseAdapter({
      ensureIndexes: true,
      url: process.env.DATABASE_URI || '',
    }),
    editor: lexicalEditor(),
    email: testEmailAdapter,
    onInit: async (payload) => {
      await seed(payload)
    },
    plugins: [
      // Demo of the notifications plugin with relationships and channels
      notificationsPlugin({
        channels: [
          {
            id: 'general',
            name: 'General Notifications',
            description: 'General updates and announcements',
          },
          {
            id: 'orders',
            name: 'Order Updates',
            description: 'Order status changes and shipping notifications',
          },
          {
            id: 'products',
            name: 'Product Updates',
            description: 'New products, restocks, and price changes',
          },
          {
            id: 'marketing',
            name: 'Marketing & Promotions',
            description: 'Special offers, sales, and promotional content',
          }
        ],
        webPush: {
          enabled: true,
          autoPush: true, // Enable automatic push notifications
          vapidPublicKey: process.env.VAPID_PUBLIC_KEY || 'BMrF5MbHcaEo6w4lPjG9m3BvONvFPfz7jLJ9t0F9yJGzSI3ZUHQj9fNUP7w2D8h1kI4x3YzJ1a4f0nS5g6t2F9L',
          vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || 'your-private-key-here',
          vapidSubject: 'mailto:test@example.com',
          // Custom notification transformer for demo
          transformNotification: (notification: any) => {
            const title = notification.title || 'New Notification'

            // Extract text from rich text message
            let body = 'You have a new notification'
            if (notification.message && Array.isArray(notification.message)) {
              const textParts: string[] = []
              notification.message.forEach((block: any) => {
                if (block.children && Array.isArray(block.children)) {
                  block.children.forEach((child: any) => {
                    if (child.text) textParts.push(child.text)
                  })
                }
              })
              if (textParts.length > 0) {
                body = textParts.join(' ').substring(0, 120) + (textParts.join(' ').length > 120 ? '...' : '')
              }
            }

            return {
              title: `🔔 ${title}`,
              body,
              icon: '/icons/notification-icon.png',
              badge: '/icons/notification-badge.png',
              data: {
                notificationId: notification.id,
                url: `/admin/collections/notifications/${notification.id}`,
                createdAt: notification.createdAt,
              },
              actions: [
                { action: 'view', title: 'View in Admin', icon: '/icons/view.png' },
                { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss.png' }
              ],
              tag: `notification-${notification.id}`,
              requireInteraction: false,
            }
          }
        }
      }),
    ],
    secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
    sharp,
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
  })
}

export default buildConfigWithMemoryDB()
