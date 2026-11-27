import type { Payload, PayloadRequest, Where } from 'payload'

import type { NotificationChannel } from '../types.js'

export const CHANNEL_SUBSCRIPTIONS_SLUG = 'channel-subscriptions'

/**
 * Key under the channel-subscriptions collection's `custom` config where the
 * plugin stores its configured channels, so the helpers below can list and
 * validate channels from a `payload` instance alone.
 */
export const CONFIGURED_CHANNELS_KEY = 'notificationChannels'

/** Thrown when a helper is given a channel id that is not in the plugin's `channels` option. */
export class UnknownChannelError extends Error {
  constructor(channel: string) {
    super(`Unknown notification channel "${channel}"`)
    this.name = 'UnknownChannelError'
  }
}

/** A user document or its id. */
export type ChannelSubscriptionUser = { id: number | string } | number | string

/** One configured channel together with a user's subscription state for it. */
export interface ChannelSubscriptionState extends NotificationChannel {
  /** False only when the user has opted out; a user without a stored choice is subscribed. */
  subscribed: boolean
}

interface BaseArgs {
  payload: Payload
  /**
   * Pass the current request when calling from a hook or endpoint so the
   * queries join its transaction. Access control is not applied either way.
   */
  req?: PayloadRequest
  user: ChannelSubscriptionUser
}

const userId = (user: ChannelSubscriptionUser): number | string =>
  typeof user === 'object' ? user.id : user

// The slug is cast because a host's generated Payload types narrow collection
// slugs to that host's own union, which this package cannot know statically.
const collection = CHANNEL_SUBSCRIPTIONS_SLUG as 'users'

/**
 * The channels from the plugin's `channels` option, or `null` when the
 * channel-subscriptions collection is not registered (for example a host that
 * uses `WebPushManager` on its own, without `notificationsPlugin`).
 */
function configuredChannels(payload: Payload): NotificationChannel[] | null {
  const config = payload.collections?.[CHANNEL_SUBSCRIPTIONS_SLUG]?.config
  if (!config) { return null }
  return (config.custom?.[CONFIGURED_CHANNELS_KEY] as NotificationChannel[] | undefined) ?? []
}

/**
 * The ids of the channels a user has opted out of. A user is subscribed to
 * every channel by default, so only explicit opt-outs are stored as
 * `subscribed: false` rows and returned here.
 */
export async function getUnsubscribedChannels({ payload, req, user }: BaseArgs): Promise<string[]> {
  if (!configuredChannels(payload)) { return [] }
  const { docs } = await payload.find({
    collection,
    depth: 0,
    pagination: false,
    req,
    where: {
      and: [
        { user: { equals: userId(user) } },
        { subscribed: { equals: false } },
      ],
    },
  })
  return (docs as unknown as Array<{ channel: string }>).map((doc) => doc.channel)
}

/**
 * Every configured channel with the user's subscription state, in the order
 * of the plugin's `channels` option.
 */
export async function listChannelSubscriptions(args: BaseArgs): Promise<ChannelSubscriptionState[]> {
  const unsubscribed = new Set(await getUnsubscribedChannels(args))
  return (configuredChannels(args.payload) ?? []).map((channel) => ({
    ...channel,
    subscribed: !unsubscribed.has(channel.id),
  }))
}

/**
 * Whether notifications in `channel` should be delivered to the user. True
 * unless the user opted out of that channel, including for channels that are
 * not configured and when the channel-subscriptions collection is absent.
 */
export async function isSubscribedToChannel({ channel, ...args }: { channel: string } & BaseArgs): Promise<boolean> {
  return !(await getUnsubscribedChannels(args)).includes(channel)
}

/**
 * Stores the user's choice for one channel, creating or updating their single
 * row for it.
 *
 * @throws UnknownChannelError when `channel` is not a configured channel id.
 */
export async function setChannelSubscription({
  channel,
  payload,
  req,
  subscribed,
  user,
}: { channel: string; subscribed: boolean } & BaseArgs): Promise<ChannelSubscriptionState> {
  const definition = configuredChannels(payload)?.find((candidate) => candidate.id === channel)
  if (!definition) { throw new UnknownChannelError(channel) }

  const existing = await payload.find({
    collection,
    depth: 0,
    limit: 1,
    req,
    where: {
      and: [
        { user: { equals: userId(user) } },
        { channel: { equals: channel } },
      ],
    },
  })
  if (existing.docs.length > 0) {
    await payload.update({
      id: existing.docs[0].id,
      collection,
      data: { subscribed } as any,
      depth: 0,
      req,
    })
  } else {
    await payload.create({
      collection,
      data: { channel, subscribed, user: userId(user) } as any,
      depth: 0,
      req,
    })
  }
  return { ...definition, subscribed }
}

/** Subscribes the user to a channel (undoes an opt-out). */
export const subscribeToChannel = (args: { channel: string } & BaseArgs) =>
  setChannelSubscription({ ...args, subscribed: true })

/** Opts the user out of a channel. */
export const unsubscribeFromChannel = (args: { channel: string } & BaseArgs) =>
  setChannelSubscription({ ...args, subscribed: false })

/**
 * A `where` clause for the notifications collection that leaves out the
 * channels the user opted out of. Notifications without a channel always
 * match. Combine it with the user's access (`overrideAccess: false, user`)
 * for an inbox query; the clause is a preference filter, not access control.
 */
export async function subscribedChannelsWhere(args: BaseArgs): Promise<Where> {
  const unsubscribed = await getUnsubscribedChannels(args)
  if (unsubscribed.length === 0) { return {} }
  // `not_in` alone would drop notifications without a channel on SQL
  // adapters, where NULL NOT IN (...) is not true.
  return {
    or: [
      { channel: { exists: false } },
      { channel: { not_in: unsubscribed } },
    ],
  }
}
