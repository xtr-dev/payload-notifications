/**
 * Service Worker for Web Push Notifications
 * This file should be served as a static file (e.g., /sw.js)
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

self.addEventListener('install', (event: ExtendableEvent) => {
  console.log('[SW] Installing service worker')
  self.skipWaiting()
})

self.addEventListener('activate', (event: ExtendableEvent) => {
  console.log('[SW] Activating service worker')
  event.waitUntil(self.clients.claim())
})

// Handle push events
self.addEventListener('push', (event: PushEvent) => {
  console.log('[SW] Push event received')

  if (!event.data) {
    console.log('[SW] Push event has no data')
    return
  }

  try {
    const payload: NotificationPayload = event.data.json()
    const { title, body, ...options } = payload

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: options.icon || '/icon-192x192.png',
        badge: options.badge || '/badge-72x72.png',
        data: options.data,
        actions: options.actions,
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
        timestamp: options.timestamp || Date.now(),
        vibrate: [200, 100, 200],
        renotify: true,
      } as NotificationOptions)
    )
  } catch (error) {
    console.error('[SW] Error processing push notification:', error)
  }
})

// Handle notification clicks
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  console.log('[SW] Notification click received')

  event.notification.close()

  const data = event.notification.data || {}
  
  // Handle action button clicks
  if (event.action) {
    console.log('[SW] Action clicked:', event.action)
    
    // Custom action handling based on action type
    switch (event.action) {
      case 'view':
        if (data.url) {
          event.waitUntil(
            self.clients.openWindow(data.url)
          )
        }
        break
      case 'dismiss':
        // Just close the notification
        break
      default:
        console.log('[SW] Unknown action:', event.action)
    }
  } else {
    // Default click behavior - open the app
    const urlToOpen = data.url || '/'
    
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((windowClients: readonly WindowClient[]) => {
        // Check if there is already an open window
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus()
          }
        }
        
        // If no window is open, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen)
        }
      })
    )
  }
})

// Handle notification close events
self.addEventListener('notificationclose', (event: NotificationEvent) => {
  console.log('[SW] Notification closed:', event.notification.tag)
  
  // Optional: Send analytics or tracking data
  const data = event.notification.data || {}
  if (data.trackClose) {
    // Send tracking data to your analytics service
    fetch('/api/notifications/track', {
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