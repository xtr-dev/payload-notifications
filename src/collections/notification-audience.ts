import type {
  CollectionAfterOperationHook,
  CollectionBeforeValidateHook,
  Endpoint,
  PayloadRequest,
} from 'payload'

import { ValidationError } from 'payload'

import { NOTIFICATION_READS_SLUG } from './notification-reads.js'

/** Who can see a notification: its recipient only, or every user. */
export type NotificationAudience = 'broadcast' | 'user'

const relationId = (value: unknown): null | number | string => {
  if (value === null || value === undefined) { return null }
  if (typeof value === 'object' && 'id' in value) { return (value as { id: number | string }).id }
  return value as number | string
}

/**
 * Sets `audience` on create when the caller left it out: a notification with
 * a recipient is personal (`user`), one without is a `broadcast`. This keeps
 * `payload.create({ data: { title, message } })` creating a broadcast as it
 * did before the field existed. The audience is never derived on update, so a
 * personal notification whose recipient was later removed (for example
 * because the user was deleted) stays personal and hidden from other users.
 *
 * A broadcast with a recipient is rejected because it is ambiguous.
 */
export const deriveAudience: CollectionBeforeValidateHook = ({ data, operation, originalDoc, req }) => {
  if (!data) { return data }

  const recipient = relationId('recipient' in data ? data.recipient : originalDoc?.recipient)
  if (operation === 'create' && !data.audience) {
    data.audience = recipient === null ? 'broadcast' : 'user'
  }

  const audience = data.audience ?? originalDoc?.audience
  if (audience === 'broadcast' && recipient !== null) {
    throw new ValidationError({
      collection: 'notifications',
      errors: [{ message: 'A broadcast cannot have a recipient.', path: 'recipient' }],
      req,
    })
  }
  return data
}

/**
 * Replaces isRead/readAt on broadcasts with the requesting user's own read
 * state from notification-reads, so `find`/`findByID` (REST, GraphQL and the
 * local API with a `user`) answer "has this user read it" instead of returning
 * the single flag stored on the shared broadcast row. Requests without a user
 * see the stored values. One receipt query is made per operation, not per doc.
 *
 * Because the values are computed after the query, `where: { isRead: ... }`
 * still filters broadcasts on the stored flag; query notification-reads to
 * filter broadcasts by a user's read state.
 */
export const applyBroadcastReadState: CollectionAfterOperationHook = async ({ operation, req, result }) => {
  if (operation !== 'find' && operation !== 'findByID') { return result }
  if (!req.user || (req.user.collection && req.user.collection !== 'users') || !result) { return result }

  const docs: any[] = operation === 'find' ? ((result as any).docs ?? []) : [result]
  const broadcasts = docs.filter((doc) => doc && doc.audience === 'broadcast' && doc.id !== undefined)
  if (broadcasts.length === 0) { return result }

  const { docs: receipts } = await req.payload.find({
    collection: NOTIFICATION_READS_SLUG,
    depth: 0,
    pagination: false,
    req,
    where: {
      and: [
        { user: { equals: req.user.id } },
        { notification: { in: broadcasts.map((doc) => doc.id) } },
      ],
    },
  })
  const readAtByNotification = new Map<string, string>()
  for (const receipt of receipts as any[]) {
    readAtByNotification.set(String(relationId(receipt.notification)), receipt.readAt)
  }

  for (const doc of broadcasts) {
    const readAt = readAtByNotification.get(String(doc.id))
    doc.isRead = readAt !== undefined
    doc.readAt = readAt ?? null
  }
  return result
}

/**
 * Marks a notification read (`read: true`) or unread for the requesting user.
 * Personal notifications store this on the notification itself; broadcasts
 * store it as a notification-reads receipt for this user only.
 */
async function setReadState(req: PayloadRequest, read: boolean): Promise<Response> {
  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  const id = req.routeParams?.id as number | string | undefined
  if (id === undefined) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  // Read with the user's own access, so a notification they cannot see is a 404.
  const notification: any = await req.payload.findByID({
    id,
    collection: 'notifications',
    depth: 0,
    disableErrors: true,
    overrideAccess: false,
    req,
  })
  if (!notification) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  if (notification.audience === 'broadcast') {
    const existing = await req.payload.find({
      collection: NOTIFICATION_READS_SLUG,
      depth: 0,
      limit: 1,
      req,
      where: {
        and: [
          { user: { equals: req.user.id } },
          { notification: { equals: notification.id } },
        ],
      },
    })
    const receipt: any = existing.docs[0]
    if (read && !receipt) {
      const created: any = await req.payload.create({
        collection: NOTIFICATION_READS_SLUG,
        data: { notification: notification.id, readAt: new Date().toISOString(), user: req.user.id },
        req,
      })
      return Response.json({ id: notification.id, isRead: true, readAt: created.readAt })
    }
    if (!read && receipt) {
      await req.payload.delete({ id: receipt.id, collection: NOTIFICATION_READS_SLUG, req })
    }
    return Response.json({
      id: notification.id,
      isRead: read,
      readAt: read ? receipt.readAt : null,
    })
  }

  // A personal notification's read flag belongs to its recipient, so even an
  // admin cannot mark someone else's notification read through this endpoint.
  if (String(relationId(notification.recipient)) !== String(req.user.id)) {
    return Response.json({ error: 'Only the recipient can change the read state' }, { status: 403 })
  }
  const updated: any = await req.payload.update({
    id: notification.id,
    collection: 'notifications',
    data: { isRead: read, readAt: read ? new Date().toISOString() : null },
    depth: 0,
    req,
  })
  return Response.json({ id: updated.id, isRead: updated.isRead, readAt: updated.readAt ?? null })
}

/**
 * `POST /api/notifications/:id/read` marks a notification read for the
 * signed-in user; `DELETE` on the same path marks it unread. Works for both
 * personal notifications and broadcasts.
 */
export const markNotificationReadEndpoints: Endpoint[] = [
  { handler: (req) => setReadState(req, true), method: 'post', path: '/:id/read' },
  { handler: (req) => setReadState(req, false), method: 'delete', path: '/:id/read' },
]
