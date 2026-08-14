import type { Payload, SanitizedConfig } from 'payload'

import config from '@payload-config'
import { rm } from 'fs/promises'
import { createPayloadRequest, getPayload } from 'payload'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

// The channel ids configured in dev/payload.config.ts — the plugin must turn
// exactly these into the select options on both generated collections.
const CONFIGURED_CHANNEL_IDS = ['general', 'orders', 'products', 'marketing']

let payload: Payload
let resolvedConfig: SanitizedConfig

// Invokes a plugin endpoint's handler the way Payload's router would,
// so the tests exercise the real handler including auth and body parsing.
const callEndpoint = async (path: string, method: string, body?: unknown) => {
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
  return endpoint!.handler(payloadRequest)
}

beforeAll(async () => {
  // The scratch database is deleted so every run starts from an empty schema
  // and the seed. Gated on the *int-test.db name because DATABASE_URI is the
  // same variable dev/payload.config.ts reads for the dev server, and it can
  // arrive from the shell or dev/.env (vitest.config.js loads that file)
  // pointing at a real database — an inherited DATABASE_URI=file:./dev.db may
  // redirect the suite, but must never delete the dev data.
  const uri = process.env.DATABASE_URI
  if (uri?.startsWith('file:') && uri.endsWith('int-test.db')) {
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
    // autoPush is on in the dev config with placeholder VAPID keys and no
    // subscriptions, so the afterChange push attempt goes nowhere — the
    // notification itself must still be created and readable.
    const { docs: users } = await payload.find({ collection: 'users', limit: 1 })
    expect(users.length).toBeGreaterThan(0)

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

    const fetched = await payload.findByID({
      id: created.id,
      collection: 'notifications',
    })
    expect(fetched.title).toBe('Integration test notification')
    expect(fetched.isRead).toBe(false)
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

  test('unsubscribe rejects a body without an endpoint', async () => {
    const response = await callEndpoint('/push-notifications/unsubscribe', 'post', {})
    expect(response.status).toBe(400)
  })
})
