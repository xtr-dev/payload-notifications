import type { Payload, SanitizedConfig } from 'payload'

import config from '@payload-config'
import { rm } from 'fs/promises'
import { basename } from 'path'
import { createPayloadRequest, getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'
import webpush from 'web-push'

// The channel ids configured in dev/payload.config.ts — the plugin must turn
// exactly these into the select options on both generated collections.
const CONFIGURED_CHANNEL_IDS = ['general', 'orders', 'products', 'marketing']

let payload: Payload
let resolvedConfig: SanitizedConfig

// Invokes a plugin endpoint's handler the way Payload's router would,
// so the tests exercise the real handler including auth and body parsing.
const callEndpoint = async (
  path: string,
  method: string,
  body?: unknown,
  user?: { id: number | string },
) => {
  const endpoint = resolvedConfig.endpoints.find(
    (e) => e.path === path && e.method === method,
  )
  expect(endpoint, `endpoint ${method.toUpperCase()} ${path} is registered`).toBeDefined()

  const request = new Request(`http://localhost:3000/api${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    method: method.toUpperCase(),
  })
  const payloadRequest = await createPayloadRequest({ config, request })
  if (user) {
    payloadRequest.user = user as typeof payloadRequest.user
  }
  return endpoint!.handler(payloadRequest)
}

beforeAll(async () => {
  // The scratch database is deleted so every run starts from an empty schema
  // and the seed. Gated on the exact int-test.db filename (not a suffix
  // match, which would also wipe e.g. not-int-test.db) because DATABASE_URI
  // is the same variable dev/payload.config.ts reads for the dev server, and
  // it can arrive from the shell or dev/.env (vitest.config.js loads that
  // file) pointing at a real database — an inherited
  // DATABASE_URI=file:./dev.db may redirect the suite, but must never delete
  // the dev data.
  const uri = process.env.DATABASE_URI
  if (uri?.startsWith('file:') && basename(uri.slice('file:'.length)) === 'int-test.db') {
    const dbPath = uri.slice('file:'.length)
    await Promise.all(
      [dbPath, `${dbPath}-wal`, `${dbPath}-shm`].map((p) => rm(p, { force: true })),
    )
  }

  payload = await getPayload({ config })
  resolvedConfig = payload.config
})

afterAll(async () => {
  // payload@3.37 has no payload.destroy(); closing the db adapter is what
  // releases the sqlite handle so vitest can exit.
  await payload.db.destroy?.()
})

describe('notifications collection', () => {
  test('is registered', () => {
    expect(payload.collections['notifications']).toBeDefined()
  })

  test('channel select options are exactly the configured channels', () => {
    const fields = payload.collections['notifications'].config.fields
    const channelField = fields.find((f) => 'name' in f && f.name === 'channel')
    expect(channelField).toBeDefined()
    expect(channelField).toMatchObject({ type: 'select' })

    const values = (channelField as { options: { value: string }[] }).options.map(
      (o) => o.value,
    )
    expect(values).toEqual(CONFIGURED_CHANNEL_IDS)
  })

  test('seed data from onInit is present', async () => {
    const { docs } = await payload.find({ collection: 'notifications' })
    expect(docs.length).toBeGreaterThanOrEqual(3)
  })

  test('a notification is stored even though web push cannot deliver', async () => {
    const { docs: users } = await payload.find({ collection: 'users', limit: 1 })
    expect(users.length).toBeGreaterThan(0)

    await payload.create({
      collection: 'push-subscriptions',
      data: {
        auth: 'auth-key',
        channels: ['general'],
        endpoint: 'https://push.example/failed-delivery',
        isActive: true,
        p256dh: 'p256dh-key',
        user: users[0].id,
      },
    })
    const sendNotification = vi
      .spyOn(webpush, 'sendNotification')
      .mockRejectedValueOnce(new Error('push service unavailable'))
    const setVapidDetails = vi.spyOn(webpush, 'setVapidDetails').mockImplementation(() => undefined)

    try {
      const created = await payload.create({
        collection: 'notifications',
        data: {
          channel: 'general',
          message: {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'Created by the integration test.' }],
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
          recipient: users[0].id,
          title: 'Integration test notification',
        },
      })

      expect(sendNotification).toHaveBeenCalledOnce()
      // The dev config's push body is the Lexical message text, and its click
      // target is the notification's admin page.
      const pushed = JSON.parse(String(sendNotification.mock.calls[0][1]))
      expect(pushed.body).toBe('Created by the integration test.')
      expect(pushed.data.url).toBe(`/admin/collections/notifications/${created.id}`)
      const fetched = await payload.findByID({
        id: created.id,
        collection: 'notifications',
      })
      expect(fetched.title).toBe('Integration test notification')
      expect(fetched.isRead).toBe(false)
    } finally {
      sendNotification.mockRestore()
      setVapidDetails.mockRestore()
    }
  })
})

describe('push subscriptions (webPush.enabled)', () => {
  test('push-subscriptions collection is registered', () => {
    expect(payload.collections['push-subscriptions']).toBeDefined()
  })

  test('all three push endpoints are registered', () => {
    const paths = resolvedConfig.endpoints.map((e) => `${e.method} ${e.path}`)
    expect(paths).toEqual(
      expect.arrayContaining([
        'post /push-notifications/subscribe',
        'post /push-notifications/unsubscribe',
        'get /push-notifications/vapid-public-key',
      ]),
    )
  })

  test('vapid-public-key endpoint returns the configured public key', async () => {
    const response = await callEndpoint('/push-notifications/vapid-public-key', 'get')
    expect(response.status).toBe(200)

    const data = await response.json()
    // Mirrors the fallback in dev/payload.config.ts, so the assertion holds
    // with or without a VAPID_PUBLIC_KEY in dev/.env.
    expect(data.publicKey).toBe(
      process.env.VAPID_PUBLIC_KEY ||
        'BMrF5MbHcaEo6w4lPjG9m3BvONvFPfz7jLJ9t0F9yJGzSI3ZUHQj9fNUP7w2D8h1kI4x3YzJ1a4f0nS5g6t2F9L',
    )
  })

  test('subscribe refuses an unauthenticated request', async () => {
    const response = await callEndpoint('/push-notifications/subscribe', 'post', {
      channels: ['general'],
      subscription: { endpoint: 'https://push.example/abc', keys: { auth: 'a', p256dh: 'p' } },
      userAgent: 'vitest',
    })
    expect(response.status).toBe(401)
  })

  test('unsubscribe rejects an unauthenticated request', async () => {
    const response = await callEndpoint('/push-notifications/unsubscribe', 'post', {
      endpoint: 'https://push.example/abc',
    })
    expect(response.status).toBe(401)
  })

  test('unsubscribe only deactivates the requesters subscription', async () => {
    const { docs: users } = await payload.find({ collection: 'users', limit: 2 })
    expect(users).toHaveLength(2)
    const [owner, otherUser] = users
    const endpoint = 'https://push.example/owned-by-first-user'

    const subscription = await payload.create({
      collection: 'push-subscriptions',
      data: {
        auth: 'auth-key',
        endpoint,
        isActive: true,
        p256dh: 'p256dh-key',
        user: owner.id,
      },
    })

    const response = await callEndpoint(
      '/push-notifications/unsubscribe',
      'post',
      { endpoint },
      otherUser,
    )
    expect(response.status).toBe(200)

    const unchanged = await payload.findByID({
      id: subscription.id,
      collection: 'push-subscriptions',
    })
    expect(unchanged.isActive).toBe(true)

    const ownerResponse = await callEndpoint(
      '/push-notifications/unsubscribe',
      'post',
      { endpoint },
      owner,
    )
    expect(ownerResponse.status).toBe(200)

    const deactivated = await payload.findByID({
      id: subscription.id,
      collection: 'push-subscriptions',
    })
    expect(deactivated.isActive).toBe(false)
  })

  test('unsubscribe rejects a body without an endpoint', async () => {
    const { docs: users } = await payload.find({ collection: 'users', limit: 1 })
    const response = await callEndpoint('/push-notifications/unsubscribe', 'post', {}, users[0])
    expect(response.status).toBe(400)
  })

  test('subscribe does not let one user take over another users endpoint', async () => {
    const { docs: users } = await payload.find({ collection: 'users', limit: 2 })
    expect(users).toHaveLength(2)
    const [owner, otherUser] = users
    const endpoint = 'https://push.example/owned-subscribe-endpoint'

    const subscription = await payload.create({
      collection: 'push-subscriptions',
      data: {
        auth: 'owner-auth',
        endpoint,
        isActive: true,
        p256dh: 'owner-p256dh',
        user: owner.id,
      },
    })

    const response = await callEndpoint(
      '/push-notifications/subscribe',
      'post',
      {
        channels: ['general'],
        subscription: {
          endpoint,
          keys: { auth: 'attacker-auth', p256dh: 'attacker-p256dh' },
        },
        userAgent: 'vitest',
      },
      otherUser,
    )
    expect(response.status).toBe(403)

    const unchanged = await payload.findByID({
      id: subscription.id,
      collection: 'push-subscriptions',
      depth: 0,
    })
    expect(String(unchanged.user)).toBe(String(owner.id))
    expect(unchanged.auth).toBe('owner-auth')
    expect(unchanged.p256dh).toBe('owner-p256dh')
    expect(unchanged.isActive).toBe(true)
  })
})

describe('notification audience, access and per-user read state', () => {
  const message = (text: string) => ({
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text, version: 1 }],
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          version: 1,
        },
      ],
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
    },
  })

  let counter = 0
  const createMember = async () =>
    payload.create({
      collection: 'users',
      data: { email: `member-${Date.now()}-${counter++}@example.com`, password: 'test', role: 'customer' },
    })

  const createAdmin = async () =>
    payload.create({
      collection: 'users',
      data: { email: `admin-${Date.now()}-${counter++}@example.com`, password: 'test', role: 'admin' },
    })

  // Calls a notifications collection endpoint (e.g. POST /:id/read) the way
  // Payload's REST router would, with the route params it would extract.
  const callCollectionEndpoint = async (
    path: string,
    method: string,
    id: number | string,
    user?: { id: number | string },
  ) => {
    const endpoint = (payload.collections['notifications'].config.endpoints || []).find(
      (e) => e.path === path && e.method === method,
    )
    expect(endpoint, `endpoint ${method.toUpperCase()} ${path} is registered`).toBeDefined()
    const request = new Request(`http://localhost:3000/api/notifications/${id}/read`, {
      method: method.toUpperCase(),
    })
    const payloadRequest = await createPayloadRequest({ config, request })
    if (user) {
      payloadRequest.user = { ...user, collection: 'users' } as typeof payloadRequest.user
    }
    payloadRequest.routeParams = { id, collection: 'notifications' }
    return endpoint!.handler(payloadRequest)
  }

  test('audience is derived from the recipient on create, and a broadcast cannot have a recipient', async () => {
    const member = await createMember()
    const personal = await payload.create({
      collection: 'notifications',
      data: { message: message('p'), recipient: member.id, title: 'Personal' },
    })
    const broadcast = await payload.create({
      collection: 'notifications',
      data: { message: message('b'), title: 'Broadcast' },
    })
    expect(personal.audience).toBe('user')
    expect(broadcast.audience).toBe('broadcast')

    await expect(
      payload.create({
        collection: 'notifications',
        data: { audience: 'broadcast', message: message('x'), recipient: member.id, title: 'Ambiguous' },
      }),
    ).rejects.toThrow()
  })

  test("members cannot read other members' personal notifications", async () => {
    const memberA = await createMember()
    const memberB = await createMember()
    const forB = await payload.create({
      collection: 'notifications',
      data: { message: message('secret'), recipient: memberB.id, title: 'For B only' },
    })
    const broadcast = await payload.create({
      collection: 'notifications',
      data: { message: message('hello'), title: 'For everyone' },
    })

    const { docs } = await payload.find({
      collection: 'notifications',
      overrideAccess: false,
      pagination: false,
      user: memberA,
    })
    const ids = docs.map((doc) => doc.id)
    expect(ids).not.toContain(forB.id)
    expect(ids).toContain(broadcast.id)
    for (const doc of docs) {
      const recipient = typeof doc.recipient === 'object' ? doc.recipient?.id : doc.recipient
      expect(doc.audience === 'broadcast' || recipient === memberA.id).toBe(true)
    }

    const asB = await payload.find({
      collection: 'notifications',
      overrideAccess: false,
      user: memberB,
      where: { id: { equals: forB.id } },
    })
    expect(asB.docs).toHaveLength(1)
  })

  test('only admins can create notifications through the access-checked API', async () => {
    const memberA = await createMember()
    const memberB = await createMember()
    const admin = await createAdmin()

    await expect(
      payload.create({
        collection: 'notifications',
        data: { message: message('click here'), recipient: memberB.id, title: 'Spoofed' },
        overrideAccess: false,
        user: memberA,
      }),
    ).rejects.toThrow()

    const created = await payload.create({
      collection: 'notifications',
      data: { message: message('hi'), recipient: memberB.id, title: 'From admin' },
      overrideAccess: false,
      user: admin,
    })
    expect(created.id).toBeDefined()
  })

  test('marking a broadcast read is per member', async () => {
    const memberA = await createMember()
    const memberB = await createMember()
    const broadcast = await payload.create({
      collection: 'notifications',
      data: { message: message('news'), title: 'Studio news' },
    })

    // The shared row itself can no longer be flipped by a member.
    await expect(
      payload.update({
        id: broadcast.id,
        collection: 'notifications',
        data: { isRead: true },
        overrideAccess: false,
        user: memberA,
      }),
    ).rejects.toThrow()

    const response = await callCollectionEndpoint('/:id/read', 'post', broadcast.id, memberA)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ id: broadcast.id, isRead: true })

    const asA = await payload.findByID({
      id: broadcast.id,
      collection: 'notifications',
      overrideAccess: false,
      user: memberA,
    })
    const asB = await payload.findByID({
      id: broadcast.id,
      collection: 'notifications',
      overrideAccess: false,
      user: memberB,
    })
    expect(asA.isRead).toBe(true)
    expect(asA.readAt).toBeTruthy()
    expect(asB.isRead).toBe(false)
    expect(asB.readAt).toBeNull()

    const listAsB = await payload.find({
      collection: 'notifications',
      overrideAccess: false,
      user: memberB,
      where: { id: { equals: broadcast.id } },
    })
    expect(listAsB.docs[0].isRead).toBe(false)

    // Marking read twice is idempotent, and DELETE marks it unread again.
    expect((await callCollectionEndpoint('/:id/read', 'post', broadcast.id, memberA)).status).toBe(200)
    expect((await callCollectionEndpoint('/:id/read', 'delete', broadcast.id, memberA)).status).toBe(200)
    const unread = await payload.findByID({
      id: broadcast.id,
      collection: 'notifications',
      overrideAccess: false,
      user: memberA,
    })
    expect(unread.isRead).toBe(false)
  })

  test('read endpoint updates personal notifications for their recipient only', async () => {
    const memberA = await createMember()
    const memberB = await createMember()
    const forA = await payload.create({
      collection: 'notifications',
      data: { message: message('a'), recipient: memberA.id, title: 'For A' },
    })

    expect((await callCollectionEndpoint('/:id/read', 'post', forA.id, memberB)).status).toBe(404)
    expect((await callCollectionEndpoint('/:id/read', 'post', forA.id)).status).toBe(401)

    const response = await callCollectionEndpoint('/:id/read', 'post', forA.id, memberA)
    expect(response.status).toBe(200)
    const stored = await payload.findByID({ id: forA.id, collection: 'notifications' })
    expect(stored.isRead).toBe(true)
    expect(stored.readAt).toBeTruthy()
  })

  test('members can only record their own reads of broadcasts', async () => {
    const memberA = await createMember()
    const memberB = await createMember()
    const forB = await payload.create({
      collection: 'notifications',
      data: { message: message('b'), recipient: memberB.id, title: 'For B' },
    })
    const broadcast = await payload.create({
      collection: 'notifications',
      data: { message: message('b'), title: 'Broadcast' },
    })

    await expect(
      payload.create({
        collection: 'notification-reads',
        data: { notification: forB.id, readAt: new Date().toISOString(), user: memberA.id },
        overrideAccess: false,
        user: memberA,
      }),
    ).rejects.toThrow()

    const receipt = await payload.create({
      collection: 'notification-reads',
      data: { notification: broadcast.id, readAt: new Date().toISOString(), user: memberB.id },
      overrideAccess: false,
      user: memberA,
    })
    const receiptUser = typeof receipt.user === 'object' ? receipt.user.id : receipt.user
    expect(receiptUser).toBe(memberA.id)
  })

  test("a deleted user's personal notifications never become broadcasts", async () => {
    const doomed = await createMember()
    const other = await createMember()
    const personal = await payload.create({
      collection: 'notifications',
      data: { message: message('k'), recipient: doomed.id, title: 'Your booking KC-123 is confirmed' },
    })

    // Deleting the row directly skips hooks, so the SQL foreign key sets the
    // recipient to null. The notification must stay personal and hidden.
    await payload.db.deleteOne({ collection: 'users', where: { id: { equals: doomed.id } } })
    const orphan = await payload.findByID({ id: personal.id, collection: 'notifications' })
    expect(orphan.recipient ?? null).toBeNull()
    expect(orphan.audience).toBe('user')

    const { docs } = await payload.find({
      collection: 'notifications',
      overrideAccess: false,
      pagination: false,
      user: other,
    })
    expect(docs.map((doc) => doc.id)).not.toContain(personal.id)
  })

  test("deleting a user through Payload removes their notification data", async () => {
    const doomed = await createMember()
    const personal = await payload.create({
      collection: 'notifications',
      data: { message: message('k'), recipient: doomed.id, title: 'Bye' },
    })
    const broadcast = await payload.create({
      collection: 'notifications',
      data: { message: message('b'), title: 'Broadcast' },
    })
    await payload.create({
      collection: 'notification-reads',
      data: { notification: broadcast.id, readAt: new Date().toISOString(), user: doomed.id },
    })

    await payload.delete({ id: doomed.id, collection: 'users' })

    const remaining = await payload.find({
      collection: 'notifications',
      where: { id: { equals: personal.id } },
    })
    expect(remaining.docs).toHaveLength(0)
    const reads = await payload.find({
      collection: 'notification-reads',
      where: { notification: { equals: broadcast.id } },
    })
    expect(reads.docs).toHaveLength(0)
    // The broadcast itself is untouched.
    expect((await payload.findByID({ id: broadcast.id, collection: 'notifications' })).id).toBe(broadcast.id)
  })
})
