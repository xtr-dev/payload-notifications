import { describe, expect, test } from 'vitest'

import { createNotificationsCollection } from './notifications'

const collection = createNotificationsCollection({
  channels: [{ id: 'general', name: 'General' }],
})
const update = collection.access?.update as (args: { req: { user?: { id: string; role?: string } } }) => unknown

function canUpdateField(name: string, user?: { id: string; role?: string }) {
  const field = collection.fields.find((candidate) => 'name' in candidate && candidate.name === name) as {
    access?: { update?: (args: { req: { user?: { id: string; role?: string } } }) => unknown }
  } | undefined
  const fieldAccess = field?.access?.update
  if (typeof fieldAccess !== 'function') return true
  return fieldAccess({ req: { user } })
}

describe('notifications collection update access', () => {
  test('lets authenticated users update their notifications and recipient-less rows', () => {
    expect(update({ req: { user: { id: 'user-1' } } })).toEqual({
      or: [
        { recipient: { equals: 'user-1' } },
        { recipient: { exists: false } },
      ],
    })
  })

  test('keeps unauthenticated users out and allows administrators to update any notification', () => {
    expect(update({ req: {} })).toBe(false)
    expect(update({ req: { user: { id: 'admin-1', role: 'admin' } } })).toBe(true)
  })

  test('limits non-admin field updates to isRead and readAt', () => {
    const user = { id: 'user-1' }
    expect(canUpdateField('title', user)).toBe(false)
    expect(canUpdateField('message', user)).toBe(false)
    expect(canUpdateField('recipient', user)).toBe(false)
    expect(canUpdateField('channel', user)).toBe(false)
    expect(canUpdateField('isRead', user)).toBe(true)
    expect(canUpdateField('readAt', user)).toBe(true)
  })

  test('lets administrators update every field', () => {
    const admin = { id: 'admin-1', role: 'admin' }
    expect(canUpdateField('title', admin)).toBe(true)
    expect(canUpdateField('message', admin)).toBe(true)
    expect(canUpdateField('recipient', admin)).toBe(true)
    expect(canUpdateField('channel', admin)).toBe(true)
    expect(canUpdateField('isRead', admin)).toBe(true)
    expect(canUpdateField('readAt', admin)).toBe(true)
  })
})
