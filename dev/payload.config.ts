
import {sqliteAdapter} from "@payloadcms/db-sqlite"
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { notificationsPlugin } from '@xtr-dev/payload-notifications'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import {seed} from "./seed"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

export default buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    // Users collection with roles for authentication
    {
      slug: 'users',
      admin: {
        useAsTitle: 'email',
      },
      auth: true,
      fields: [
        {
          name: 'role',
          type: 'select',
          defaultValue: 'customer',
          options: [
            { label: 'Admin', value: 'admin' },
            { label: 'Customer', value: 'customer' },
          ],
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
  db: sqliteAdapter({
    client: {
      url: process.env.DATABASE_URI || 'file:./dev.db',
    },
  }),
  editor: lexicalEditor(),
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
      // Demo of host-added fields. Only the paths in recipientEditableFields
      // can be changed by a notification's recipient; `priority` and
      // `preferences.internalNote` stay admin-only like the plugin's own fields.
      collectionOverrides: {
        notifications: (collection) => ({
          ...collection,
          fields: [
            ...collection.fields,
            {
              name: 'priority',
              type: 'select',
              defaultValue: 'normal',
              options: [
                { label: 'Low', value: 'low' },
                { label: 'Normal', value: 'normal' },
                { label: 'High', value: 'high' },
              ],
            },
            { name: 'archived', type: 'checkbox', defaultValue: false },
            {
              name: 'preferences',
              type: 'group',
              fields: [
                { name: 'pinned', type: 'checkbox', defaultValue: false },
                { name: 'internalNote', type: 'text' },
              ],
            },
          ],
        }),
      },
      recipientEditableFields: ['archived', 'preferences.pinned'],
      webPush: {
        autoPush: true, // Enable automatic push notifications
        enabled: true,
        vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || 'your-private-key-here',
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY || 'BMrF5MbHcaEo6w4lPjG9m3BvONvFPfz7jLJ9t0F9yJGzSI3ZUHQj9fNUP7w2D8h1kI4x3YzJ1a4f0nS5g6t2F9L',
        vapidSubject: 'mailto:test@example.com',
        // The default transformer extracts the message text (Lexical or Slate)
        // and adds the close-tracking data; only the click target is customized.
        notificationUrl: (notification: any) => `/admin/collections/notifications/${notification.id}`,
      }
    }),
  ],
  secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
