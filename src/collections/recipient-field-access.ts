import type { Field, FieldAccess, Tab } from 'payload'

/**
 * The fields that hold a personal notification's read state. A recipient may
 * always update these on their own notification.
 */
export const READ_STATE_FIELDS = ['isRead', 'readAt'] as const

/**
 * The fields that decide who can see a notification. They can never be made
 * recipient-editable: a recipient who could change them could hand their
 * notification to another user or turn it into a broadcast for everyone.
 */
const VISIBILITY_FIELDS = ['recipient', 'audience']

type IsPrivileged = (user: unknown) => boolean

/**
 * Returns a copy of `fields` in which every data field is updatable by
 * privileged users only, except the read-state fields and the field paths in
 * `recipientEditableFields`.
 *
 * It runs on the final notifications collection, after the host's
 * `collectionOverrides.notifications`, so fields the host added are covered
 * as well as the plugin's own. The rule is expressed as Payload field-level
 * `access.update`, which Payload applies to REST, GraphQL and Local API calls
 * made with `overrideAccess: false`, and which makes the admin UI render the
 * fields read-only for users who cannot change them.
 *
 * Paths use dots for nesting (`preferences.pinned`). An allowed path covers
 * everything below it. A field above an allowed path (the `preferences` group)
 * is left open so the data can reach the allowed child, and its other children
 * are restricted individually. A restricted field keeps any `access.update` it
 * already had: both that rule and the privileged check must pass.
 *
 * @throws when a path names a visibility field or matches no field, so a typo
 * cannot silently leave a field locked or, worse, be mistaken for a rule.
 */
export function restrictRecipientUpdates(
  fields: Field[],
  recipientEditableFields: readonly string[],
  isPrivileged: IsPrivileged,
): Field[] {
  for (const path of recipientEditableFields) {
    const topLevelName = path.split('.')[0]
    if (VISIBILITY_FIELDS.includes(topLevelName)) {
      throw new Error(
        `notifications plugin: "${path}" cannot be listed in recipientEditableFields, because "${topLevelName}" decides who can see a notification.`,
      )
    }
  }

  const allowed = new Set<string>([...READ_STATE_FIELDS, ...recipientEditableFields])
  const matched = new Set<string>()
  const hasAllowedDescendant = (path: string) =>
    [...allowed].some((allowedPath) => allowedPath.startsWith(`${path}.`))

  // Stays synchronous when the field had no rule of its own, so the result
  // can be used wherever Payload accepts a plain boolean.
  const privilegedOnly = (existing?: FieldAccess): FieldAccess => (args) => {
    if (!isPrivileged(args.req.user)) { return false }
    return existing ? existing(args) : true
  }

  const walk = (level: Field[], prefix: string): Field[] =>
    level.map((field): Field => {
      // Tabs hold no data themselves. A named tab nests its fields under its
      // name like a group does; an unnamed tab's fields belong to the parent.
      if (field.type === 'tabs') {
        return {
          ...field,
          tabs: field.tabs.map((tab): Tab => {
            const tabName = 'name' in tab && tab.name ? tab.name : undefined
            if (tabName === undefined) {
              return { ...tab, fields: walk(tab.fields, prefix) }
            }
            const tabPath = `${prefix}${tabName}`
            if (allowed.has(tabPath)) {
              matched.add(tabPath)
              return tab
            }
            return { ...tab, fields: walk(tab.fields, `${tabPath}.`) }
          }),
        }
      }

      const name = 'name' in field && field.name ? field.name : undefined

      // Layout fields without a name (row, collapsible, unnamed group) store
      // their children at the parent's level.
      if (name === undefined) {
        return 'fields' in field ? { ...field, fields: walk(field.fields, prefix) } as Field : field
      }

      const path = `${prefix}${name}`
      if (allowed.has(path)) {
        matched.add(path)
        return field
      }

      if (hasAllowedDescendant(path)) {
        if (field.type === 'group' || field.type === 'array') {
          return { ...field, fields: walk(field.fields, `${path}.`) }
        }
        if (field.type === 'blocks') {
          return {
            ...field,
            blocks: field.blocks.map((block) => ({ ...block, fields: walk(block.fields, `${path}.`) })),
          }
        }
      }

      const access = (field as { access?: { update?: FieldAccess } }).access
      return {
        ...field,
        access: { ...access, update: privilegedOnly(access?.update) },
      } as Field
    })

  const restricted = walk(fields, '')

  const unknown = recipientEditableFields.filter((path) => !matched.has(path))
  if (unknown.length > 0) {
    throw new Error(
      `notifications plugin: recipientEditableFields lists ${unknown.map((path) => `"${path}"`).join(', ')}, which ${unknown.length === 1 ? 'is' : 'are'} not on the notifications collection.`,
    )
  }
  return restricted
}
