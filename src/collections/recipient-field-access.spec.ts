import type { Field } from 'payload'

import { describe, expect, test } from 'vitest'

import { restrictRecipientUpdates } from './recipient-field-access'

const isAdmin = (user: unknown) => (user as { role?: string } | undefined)?.role === 'admin'
const member = { id: 'user-1' }
const admin = { id: 'admin-1', role: 'admin' }

/** Finds a field by dotted path, looking through groups, arrays, rows and tabs. */
function fieldAt(fields: Field[], path: string): Field | undefined {
  const [head, ...rest] = path.split('.')
  for (const field of fields) {
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        if ('name' in tab && tab.name === head) {
          return fieldAt(tab.fields, rest.join('.'))
        }
        const found = !('name' in tab && tab.name) && fieldAt(tab.fields, path)
        if (found) { return found }
      }
    } else if ('name' in field && field.name === head) {
      return rest.length === 0 ? field : fieldAt((field as { fields: Field[] }).fields, rest.join('.'))
    } else if (!('name' in field) && 'fields' in field) {
      const found = fieldAt(field.fields, path)
      if (found) { return found }
    }
  }
  return undefined
}

/** Whether `user` passes the update rule of the field at `path` (no rule means yes). */
async function canUpdate(fields: Field[], path: string, user: unknown) {
  const field = fieldAt(fields, path) as { access?: { update?: (args: any) => unknown } } | undefined
  expect(field, `field ${path} exists`).toBeDefined()
  const rule = field?.access?.update
  return rule ? Boolean(await rule({ req: { user } })) : true
}

const fields: Field[] = [
  { name: 'title', type: 'text' },
  { name: 'isRead', type: 'checkbox' },
  { name: 'readAt', type: 'date' },
  { name: 'archived', type: 'checkbox' },
  { name: 'priority', type: 'text' },
  {
    name: 'preferences',
    type: 'group',
    fields: [
      { name: 'pinned', type: 'checkbox' },
      { name: 'internalNote', type: 'text' },
    ],
  },
  { type: 'row', fields: [{ name: 'inRow', type: 'text' }, { name: 'inRowAllowed', type: 'text' }] },
  {
    type: 'tabs',
    tabs: [
      { fields: [{ name: 'inUnnamedTab', type: 'text' }], label: 'Unnamed' },
      { name: 'meta', fields: [{ name: 'color', type: 'text' }, { name: 'secret', type: 'text' }] },
    ],
  },
  { name: 'tags', type: 'array', fields: [{ name: 'label', type: 'text' }] },
]

describe('restrictRecipientUpdates', () => {
  const restricted = restrictRecipientUpdates(
    fields,
    ['archived', 'preferences.pinned', 'inRowAllowed', 'meta.color'],
    isAdmin,
  )

  test('a non-admin can update read state and the listed paths only', async () => {
    for (const path of ['isRead', 'readAt', 'archived', 'preferences.pinned', 'inRowAllowed', 'meta.color']) {
      expect(await canUpdate(restricted, path, member), path).toBe(true)
    }
    for (const path of ['title', 'priority', 'preferences.internalNote', 'inRow', 'inUnnamedTab', 'meta.secret', 'tags']) {
      expect(await canUpdate(restricted, path, member), path).toBe(false)
    }
  })

  test('a group above a listed path stays open so the listed child can be reached', async () => {
    expect(await canUpdate(restricted, 'preferences', member)).toBe(true)
  })

  test('an admin can update every field', async () => {
    for (const path of ['title', 'priority', 'preferences.internalNote', 'inRow', 'inUnnamedTab', 'meta.secret', 'tags', 'archived']) {
      expect(await canUpdate(restricted, path, admin), path).toBe(true)
    }
  })

  test('listing a group opens everything below it', async () => {
    const result = restrictRecipientUpdates(fields, ['preferences'], isAdmin)
    expect(await canUpdate(result, 'preferences.pinned', member)).toBe(true)
    expect(await canUpdate(result, 'preferences.internalNote', member)).toBe(true)
  })

  test("a restricted field keeps the host's own update rule in addition to the admin check", async () => {
    const result = restrictRecipientUpdates(
      [{ name: 'locked', type: 'text', access: { update: () => false } }],
      [],
      isAdmin,
    )
    expect(await canUpdate(result, 'locked', admin)).toBe(false)
    expect(await canUpdate(result, 'locked', member)).toBe(false)
  })

  test('does not modify the field objects it was given', () => {
    expect((fields[0] as { access?: unknown }).access).toBeUndefined()
  })

  test('rejects recipient and audience, which decide who sees the notification', () => {
    const visibility: Field[] = [
      { name: 'recipient', type: 'text' },
      { name: 'audience', type: 'text' },
    ]
    expect(() => restrictRecipientUpdates(visibility, ['recipient'], isAdmin)).toThrow(/recipient/)
    expect(() => restrictRecipientUpdates(visibility, ['audience'], isAdmin)).toThrow(/audience/)
  })

  test('rejects a path that matches no field', () => {
    expect(() => restrictRecipientUpdates(fields, ['archvied'], isAdmin)).toThrow(/archvied/)
    expect(() => restrictRecipientUpdates(fields, ['title.nested'], isAdmin)).toThrow(/title\.nested/)
  })
})
