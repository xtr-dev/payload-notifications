/**
 * Client-side exports for the notifications plugin
 * Import from '@xtr-dev/payload-notifications/client'
 */

import { useEffect, useState } from 'react'

import { ClientPushManager } from '../client/push-manager.js'

export { ClientPushManager }
export type { PushSubscriptionData } from '../client/push-manager.js'

// Service worker utilities
export const serviceWorkerCode = `
/**
 * Service Worker for Web Push Notifications
 * This code should be served as /sw.js or similar
 */

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
    const payload = event.data.json()
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
`

/**
 * React hook for managing push notifications
 */
export function usePushNotifications(vapidPublicKey: string, channels: string[]) {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [pushManager, setPushManager] = useState<ClientPushManager | null>(null)

  useEffect(() => {
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
    await pushManager.subscribe(channels)
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
