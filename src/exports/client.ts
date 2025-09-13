/**
 * Client-side exports for the notifications plugin
 * Import from '@xtr-dev/payload-notifications/client'
 */

export { ClientPushManager } from '../client/push-manager'
export type { PushSubscriptionData } from '../client/push-manager'

// Service worker utilities
export const serviceWorkerCode = `
/**
 * Service Worker for Web Push Notifications
 * This code should be served as /sw.js or similar
 */

declare const self: ServiceWorkerGlobalScope

interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  image?: string
  data?: any
  actions?: Array<{ action: string; title: string; icon?: string }>
  tag?: string
  requireInteraction?: boolean
  timestamp: number
}

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker')
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const payload: NotificationPayload = event.data.json()
    const { title, body, ...options } = payload

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: options.icon || '/icon-192x192.png',
        badge: options.badge || '/badge-72x72.png',
        image: options.image,
        data: options.data,
        actions: options.actions,
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
        timestamp: options.timestamp || Date.now(),
        vibrate: [200, 100, 200],
        renotify: true,
      })
    )
  } catch (error) {
    console.error('[SW] Error processing push notification:', error)
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  
  if (event.action) {
    switch (event.action) {
      case 'view':
        if (data.url) {
          event.waitUntil(self.clients.openWindow(data.url))
        }
        break
      case 'dismiss':
        break
    }
  } else {
    const urlToOpen = data.url || '/'
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus()
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen)
        }
      })
    )
  }
})

self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {}
  if (data.trackClose) {
    fetch('/api/push-notifications/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'close',
        notificationId: data.id,
        timestamp: Date.now(),
      }),
    }).catch(console.error)
  }
})

export {}
`

// React types (conditional)
interface ReactHooks {
  useState: any
  useEffect: any
}

// Try to import React hooks
let ReactHooks: ReactHooks | null = null
try {
  const React = require('react')
  ReactHooks = {
    useState: React.useState,
    useEffect: React.useEffect
  }
} catch {
  // React not available
}

/**
 * React hook for managing push notifications
 * Only works if React is available in the environment
 */
export function usePushNotifications(vapidPublicKey: string) {
  if (!ReactHooks) {
    throw new Error('React is not available. Make sure React is installed to use this hook.')
  }

  const [isSupported, setIsSupported] = ReactHooks.useState(false)
  const [isSubscribed, setIsSubscribed] = ReactHooks.useState(false)
  const [permission, setPermission] = ReactHooks.useState('default' as NotificationPermission)
  const [pushManager, setPushManager] = ReactHooks.useState(null)

  ReactHooks.useEffect(() => {
    const { ClientPushManager } = require('../client/push-manager')
    const manager = new ClientPushManager(vapidPublicKey)
    setPushManager(manager)
    setIsSupported(manager.isSupported())
    setPermission(manager.getPermissionStatus())

    if (manager.isSupported()) {
      manager.isSubscribed().then(setIsSubscribed)
    }
  }, [vapidPublicKey])

  const subscribe = async () => {
    if (!pushManager) throw new Error('Push manager not initialized')
    await pushManager.subscribe()
    setIsSubscribed(true)
    setPermission('granted')
  }

  const unsubscribe = async () => {
    if (!pushManager) throw new Error('Push manager not initialized')
    await pushManager.unsubscribe()
    setIsSubscribed(false)
  }

  const requestPermission = async () => {
    if (!pushManager) throw new Error('Push manager not initialized')
    const newPermission = await pushManager.requestPermission()
    setPermission(newPermission)
    return newPermission
  }

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    requestPermission,
    pushManager,
  }
}