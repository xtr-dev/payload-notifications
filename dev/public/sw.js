/**
 * Service Worker for Web Push Notifications
 * Payload Notifications Plugin Demo
 */

console.log('[SW] Service worker loaded')

// Service worker lifecycle events
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker')
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker')
  event.waitUntil(self.clients.claim())
})

// Handle push events
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received')

  if (!event.data) {
    console.log('[SW] Push event has no data')
    return
  }

  try {
    const payload = event.data.json()
    console.log('[SW] Push payload:', payload)
    
    const { title, body, icon, badge, image, data, actions, tag, requireInteraction } = payload

    const notificationOptions = {
      body,
      icon: icon || '/icons/notification-icon.png',
      badge: badge || '/icons/notification-badge.png',
      image,
      data,
      actions: actions || [
        { action: 'view', title: 'View', icon: '/icons/view.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss.png' }
      ],
      tag: tag || 'notification',
      requireInteraction: requireInteraction || false,
      timestamp: Date.now(),
      vibrate: [200, 100, 200],
      renotify: true,
    }

    event.waitUntil(
      self.registration.showNotification(title || 'New Notification', notificationOptions)
    )
  } catch (error) {
    console.error('[SW] Error processing push notification:', error)
    
    // Fallback notification
    event.waitUntil(
      self.registration.showNotification('New Notification', {
        body: 'You have a new notification',
        icon: '/icons/notification-icon.png',
        badge: '/icons/notification-badge.png',
        tag: 'fallback',
      })
    )
  }
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received')
  console.log('[SW] Action:', event.action)
  console.log('[SW] Notification data:', event.notification.data)

  event.notification.close()

  const data = event.notification.data || {}
  
  // Handle action button clicks
  if (event.action) {
    switch (event.action) {
      case 'view':
        if (data.url) {
          event.waitUntil(
            clients.openWindow(data.url)
          )
        } else {
          event.waitUntil(
            clients.openWindow('/admin/collections/notifications')
          )
        }
        break
      case 'dismiss':
        // Just close the notification (already done above)
        break
      default:
        console.log('[SW] Unknown action:', event.action)
    }
  } else {
    // Default click behavior - open the admin panel or specific URL
    const urlToOpen = data.url || '/admin/collections/notifications'
    
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((windowClients) => {
        // Check if there is already an open window
        for (const client of windowClients) {
          if (client.url.includes('/admin') && 'focus' in client) {
            return client.focus()
          }
        }
        
        // If no admin window is open, open a new one
        return clients.openWindow(urlToOpen)
      })
    )
  }

  // Track notification click
  if (data.notificationId) {
    fetch('/api/push-notifications/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'click',
        notificationId: data.notificationId,
        timestamp: Date.now(),
      }),
    }).catch((error) => {
      console.error('[SW] Failed to track notification click:', error)
    })
  }
})

// Handle notification close events
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag)
  
  const data = event.notification.data || {}
  
  // Track notification close
  if (data.notificationId) {
    fetch('/api/push-notifications/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'close',
        notificationId: data.notificationId,
        timestamp: Date.now(),
      }),
    }).catch((error) => {
      console.error('[SW] Failed to track notification close:', error)
    })
  }
})

// Handle background sync (optional)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag)
  
  if (event.tag === 'push-notification-sync') {
    event.waitUntil(
      // Handle offline notification sync
      Promise.resolve()
    )
  }
})

// Handle message events from the main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data)
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  
  // Handle test notifications sent from the demo page
  if (event.data && event.data.type === 'TEST_NOTIFICATION') {
    const payload = event.data.payload
    
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      data: payload.data,
      actions: [
        { action: 'view', title: 'View', icon: '/icons/view.png' },
        { action: 'dismiss', title: 'Dismiss', icon: '/icons/dismiss.png' }
      ],
      tag: 'test-notification',
      requireInteraction: false,
      timestamp: Date.now(),
      vibrate: [200, 100, 200],
    })
  }
})

console.log('[SW] Service worker setup complete')