import { describe, expect, test } from 'vitest'

import { createNotificationsCollection } from './notifications'

const collection = createNotificationsCollection({
  channels: [{ id: 'general', name: 'General' }],
})
const update = collection.access?.update as (args: { req: { user?: { id: string; role?: string } } }) => unknown

describe('notifications collection update access', () => {
  test('lets authenticated users update their notifications and recipient-less broadcasts', () => {
    expect(update({ req: { user: { id: 'user-1' } } })).toEqual({
      or: [
        { recipient: { equals: 'user-1' } },
        { recipient: { equals: null } },
      ],
    })
  })

  test('keeps unauthenticated users out and allows administrators to update any notification', () => {
    expect(update({ req: {} })).toBe(false)
    expect(update({ req: { user: { id: 'admin-1', role: 'admin' } } })).toBe(true)
  })
})
