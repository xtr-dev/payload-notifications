import type { CollectionConfig, Endpoint, PayloadRequest } from 'payload'

import type { NotificationsPluginOptions } from '../types.js'

import {
  CHANNEL_SUBSCRIPTIONS_SLUG,
  CONFIGURED_CHANNELS_KEY,
  listChannelSubscriptions,
  setChannelSubscription,
  UnknownChannelError,
} from '../utils/channelSubscriptions.js'

const isAdminUser = (user: any) => Boolean(user?.role === 'admin')

/**
 * Sets the signed-in user's own choice for the channel in the route. The user
 * always comes from the session, so these endpoints cannot change another
 * user's subscriptions.
 */
async function setOwnSubscription(req: PayloadRequest, subscribed: boolean): Promise<Response> {
  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  try {
    const state = await setChannelSubscription({
      channel: String(req.routeParams?.channel ?? ''),
      payload: req.payload,
      req,
      subscribed,
      user: req.user.id,
    })
    return Response.json({ channel: state.id, subscribed: state.subscribed })
  } catch (error) {
    if (error instanceof UnknownChannelError) {
      return Response.json({ error: error.message }, { status: 404 })
    }
    throw error
  }
}

/**
 * `GET /api/channel-subscriptions/me` lists every configured channel with the
 * signed-in user's subscription state. `POST /api/channel-subscriptions/me/:channel`
 * subscribes them to a channel and `DELETE` on the same path opts them out.
 */
const ownSubscriptionEndpoints: Endpoint[] = [
  {
    handler: async (req) => {
      if (!req.user) {
        return Response.json({ error: 'Authentication required' }, { status: 401 })
      }
      const channels = await listChannelSubscriptions({ payload: req.payload, req, user: req.user.id })
      return Response.json({ channels })
    },
    method: 'get',
    path: '/me',
  },
  { handler: (req) => setOwnSubscription(req, true), method: 'post', path: '/me/:channel' },
  { handler: (req) => setOwnSubscription(req, false), method: 'delete', path: '/me/:channel' },
]

/**
 * Creates the collection that stores each user's per-channel opt-in/opt-out.
 *
 * A user is subscribed to every channel until they opt out, so a missing row
 * means "subscribed". Each row holds one user's explicit choice for one
 * channel. The choice is honoured when pushes are sent to a recipient
 * (`WebPushManager.sendToRecipient`) and by `subscribedChannelsWhere` for
 * inbox queries. It is separate from `push-subscriptions.channels`, which
 * filters channels per browser/device.
 */
export function createChannelSubscriptionsCollection(options: NotificationsPluginOptions): CollectionConfig {
  const ownOrAdmin = ({ req }: { req: any }) => {
    if (!req.user) { return false }
    if (isAdminUser(req.user)) { return true }
    return { user: { equals: req.user.id } }
  }

  const config: CollectionConfig = {
    slug: CHANNEL_SUBSCRIPTIONS_SLUG,
    access: {
      // Any signed-in user may create a row; the beforeChange hook makes a
      // non-admin's row their own.
      create: ({ req }: { req: any }) => Boolean(req.user),
      delete: ownOrAdmin,
      read: ownOrAdmin,
      update: ownOrAdmin,
    },
    admin: {
      defaultColumns: ['user', 'channel', 'subscribed'],
      description: 'Per-user channel opt-ins and opt-outs. A user without a row for a channel is subscribed to it.',
    },
    custom: {
      [CONFIGURED_CHANNELS_KEY]: options.channels,
    },
    endpoints: ownSubscriptionEndpoints,
    fields: [
      {
        name: 'user',
        type: 'relationship',
        index: true,
        relationTo: 'users',
        required: true,
      },
      {
        name: 'channel',
        type: 'select',
        options: options.channels.map((channel) => ({
          label: channel.name,
          value: channel.id,
        })),
        required: true,
      },
      {
        name: 'subscribed',
        type: 'checkbox',
        admin: {
          description: 'Unchecked means the user opted out of this channel.',
        },
        defaultValue: true,
        required: true,
      },
    ],
    hooks: {
      beforeChange: [
        ({ data, req }: { data: any; req: any }) => {
          // Create and update both run this hook, so a non-admin can neither
          // create a row for another user nor move their own row to one.
          // Calls without a user (the Local API from server code) are trusted.
          if (req.user && !isAdminUser(req.user)) {
            data.user = req.user.id
          }
          return data
        },
      ],
    },
    // One row per user and channel.
    indexes: [{ fields: ['user', 'channel'], unique: true }],
    labels: {
      plural: 'Channel Subscriptions',
      singular: 'Channel Subscription',
    },
    timestamps: true,
  }

  return options.collectionOverrides?.channelSubscriptions
    ? options.collectionOverrides.channelSubscriptions(config)
    : config
}
