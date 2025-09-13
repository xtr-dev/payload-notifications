import type { Payload } from 'payload'

import { devUser } from './helpers/credentials.ts'

export const seed = async (payload: Payload) => {
  console.log('Seeding database...')

  // Check if admin user exists
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: {
      email: {
        equals: devUser.email,
      },
    },
  })

  let adminUser: any
  let customerUser: any

  if (!totalDocs) {
    // Create admin user
    adminUser = await payload.create({
      collection: 'users',
      data: {
        ...devUser,
        role: 'admin',
        firstName: 'Admin',
        lastName: 'User',
      },
    })
    console.log('✅ Created admin user:', devUser.email)

    // Create sample customer user
    customerUser = await payload.create({
      collection: 'users',
      data: {
        email: 'customer@example.com',
        password: 'test',
        role: 'customer',
        firstName: 'John',
        lastName: 'Customer',
      },
    })
    console.log('✅ Created customer user')
  } else {
    // Get existing users
    const existingAdmin = await payload.find({
      collection: 'users',
      where: { email: { equals: devUser.email } },
      limit: 1,
    })
    adminUser = existingAdmin.docs[0]

    const existingCustomer = await payload.find({
      collection: 'users',
      where: { email: { equals: 'customer@example.com' } },
      limit: 1,
    })
    customerUser = existingCustomer.docs[0]
  }

  // Check if sample notifications already exist
  const existingNotifications = await payload.count({ collection: 'notifications' })
  
  if (existingNotifications.totalDocs === 0) {

    // Create sample notifications
    await payload.create({
      collection: 'notifications',
      data: {
        title: 'Welcome to the Demo!',
        message: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: 'Welcome to the notifications plugin demo! This notification was created during the seeding process. Try creating your own notifications and watch the automatic push notifications work.',
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
        recipient: customerUser.id,
        channel: 'general',
        isRead: false,
      },
    })

    await payload.create({
      collection: 'notifications',
      data: {
        title: 'Orders Channel Demo',
        message: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: 'This is a sample notification for the Orders channel. Users subscribed to the Orders channel will receive notifications like this one.',
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
        recipient: customerUser.id,
        channel: 'orders',
        isRead: false,
      },
    })

    await payload.create({
      collection: 'notifications',
      data: {
        title: 'New Product Recommendation',
        message: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: 'This is a sample notification for the Products channel. This notification has been marked as read to demonstrate the read/unread functionality.',
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
        recipient: customerUser.id,
        channel: 'products',
        isRead: true,
        readAt: new Date().toISOString(),
      },
    })

    console.log('✅ Created sample notifications')
    console.log('\n🎉 Database seeded successfully!')
    console.log('\n📝 You can now:')
    console.log('   • Login as admin: dev@payloadcms.com / test')
    console.log('   • View notifications in the admin panel')
    console.log('   • Create new notifications and watch automatic push notifications!')
    console.log('   • Test the channel-based subscription system')
    console.log('   • Try the demo at /demo to subscribe to push notifications')
  } else {
    console.log('✅ Sample data already exists, skipping seed')
  }
}
