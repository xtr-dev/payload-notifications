'use client'

import { useState, useEffect } from 'react'

// Enhanced demo implementation with real service worker registration
class DemoClientPushManager {
  private vapidPublicKey: string
  private serviceWorkerPath: string
  private apiEndpoint: string

  constructor(vapidPublicKey: string, options: { serviceWorkerPath?: string; apiEndpoint?: string } = {}) {
    this.vapidPublicKey = vapidPublicKey
    this.serviceWorkerPath = options.serviceWorkerPath || '/sw.js'
    this.apiEndpoint = options.apiEndpoint || '/api/push-notifications'
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    )
  }

  public getPermissionStatus(): NotificationPermission {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'default'
    return Notification.permission
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported')
    }
    return await Notification.requestPermission()
  }

  public async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    if (!this.isSupported()) {
      throw new Error('Service workers are not supported')
    }

    try {
      const registration = await navigator.serviceWorker.register(this.serviceWorkerPath)
      console.log('Service worker registered:', registration)
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready
      
      return registration
    } catch (error) {
      console.error('Service worker registration failed:', error)
      throw error
    }
  }

  public async subscribe(): Promise<any> {
    const permission = await this.requestPermission()
    if (permission !== 'granted') {
      throw new Error('Notification permission not granted')
    }

    const registration = await this.registerServiceWorker()
    
    // For demo purposes, we'll simulate subscription without actual VAPID keys
    // In production, you would use real VAPID keys here
    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey),
      })

      console.log('Push subscription:', subscription)
      return {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
          auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
        },
      }
    } catch (error) {
      console.warn('Real push subscription failed, simulating for demo:', error)
      // Return simulated subscription for demo
      return {
        endpoint: 'demo-endpoint',
        keys: { p256dh: 'demo-key', auth: 'demo-auth' }
      }
    }
  }

  public async isSubscribed(): Promise<boolean> {
    if (!this.isSupported()) return false
    
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) return false
      
      const subscription = await registration.pushManager.getSubscription()
      return subscription !== null
    } catch {
      return false
    }
  }

  public async unsubscribe(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration) return

      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
      }
    } catch (error) {
      console.error('Unsubscribe failed:', error)
    }
  }

  public async sendTestNotification(): Promise<void> {
    // Send a test notification using the service worker
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      throw new Error('Service worker not registered')
    }

    // Simulate receiving a push message
    if (registration.active) {
      registration.active.postMessage({
        type: 'TEST_NOTIFICATION',
        payload: {
          title: 'Test Notification',
          body: 'This is a test notification from the demo!',
          icon: '/icons/notification-icon.png',
          badge: '/icons/notification-badge.png',
          data: {
            url: '/admin/collections/notifications',
            notificationId: 'demo-' + Date.now()
          }
        }
      })
    }

    // Also show a direct notification for testing
    if (Notification.permission === 'granted') {
      new Notification('Direct Test Notification', {
        body: 'This notification was sent directly from JavaScript',
        icon: '/icons/notification-icon.png',
        tag: 'direct-test'
      })
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('')
    return window.btoa(binary)
  }
}

// Available channels (should match the configuration in payload.config.ts)
const AVAILABLE_CHANNELS = [
  { id: 'general', name: 'General Notifications', description: 'General updates and announcements', defaultEnabled: true },
  { id: 'orders', name: 'Order Updates', description: 'Order status changes and shipping notifications', defaultEnabled: true },
  { id: 'products', name: 'Product Updates', description: 'New products, restocks, and price changes', defaultEnabled: false },
  { id: 'marketing', name: 'Marketing & Promotions', description: 'Special offers, sales, and promotional content', defaultEnabled: false },
]

export default function DemoPage() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [pushManager, setPushManager] = useState<DemoClientPushManager | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedChannels, setSelectedChannels] = useState<string[]>(
    AVAILABLE_CHANNELS.filter(channel => channel.defaultEnabled).map(channel => channel.id)
  )

  useEffect(() => {
    // Use the real VAPID public key from environment
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BNde-uFUkQB5BweFbOt_40Tn3xZahMop2JKT8kqRn4UqMMinieguHmVCTxwN_qfM-jZ0YFpVpIk3CWehlXcTl8A'
    const manager = new DemoClientPushManager(vapidPublicKey)
    setPushManager(manager)
    setIsSupported(manager.isSupported())
    setPermission(manager.getPermissionStatus())

    if (manager.isSupported()) {
      manager.isSubscribed().then(setIsSubscribed)
    }
  }, [])

  const handleSubscribe = async () => {
    if (!pushManager) return
    
    setLoading(true)
    try {
      const subscription = await pushManager.subscribe()
      
      // Save the subscription to Payload's database using the plugin's API endpoint
      const response = await fetch('/api/push-notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription,
          user: 'customer@example.com', // Associate with the demo customer user
          userAgent: navigator.userAgent,
          channels: selectedChannels,
        }),
      })

      if (response.ok) {
        setIsSubscribed(true)
        setPermission('granted')
        alert('Successfully subscribed to push notifications!\n\nSubscription saved to database.')
      } else {
        const error = await response.text()
        throw new Error(`Failed to save subscription: ${error}`)
      }
    } catch (error) {
      console.error('Failed to subscribe:', error)
      alert('Failed to subscribe to push notifications: ' + (error as Error).message)
    }
    setLoading(false)
  }

  const handleUnsubscribe = async () => {
    if (!pushManager) return
    
    setLoading(true)
    try {
      await pushManager.unsubscribe()
      
      // Remove the subscription from Payload's database
      const response = await fetch('/api/push-notifications/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user: 'customer@example.com', // Associate with the demo customer user
        }),
      })

      if (response.ok) {
        setIsSubscribed(false)
        alert('Successfully unsubscribed from push notifications')
      } else {
        const error = await response.text()
        console.warn('Failed to remove subscription from database:', error)
        setIsSubscribed(false)
        alert('Unsubscribed from browser, but may still be in database')
      }
    } catch (error) {
      console.error('Failed to unsubscribe:', error)
      alert('Failed to unsubscribe from push notifications: ' + (error as Error).message)
    }
    setLoading(false)
  }

  const handleTestNotification = async () => {
    if (!pushManager) return
    
    setLoading(true)
    try {
      await pushManager.sendTestNotification()
      alert('Test notification sent! Check your browser notifications.')
    } catch (error) {
      console.error('Failed to send test notification:', error)
      alert('Failed to send test notification: ' + (error as Error).message)
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Payload Notifications Plugin Demo</h1>
      
      <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>🔔 Web Push Notifications</h2>
        
        {!isSupported ? (
          <div style={{ color: 'red' }}>
            ❌ Push notifications are not supported in this browser
          </div>
        ) : (
          <div>
            <p><strong>Status:</strong> {isSubscribed ? '✅ Subscribed' : '❌ Not subscribed'}</p>
            <p><strong>Permission:</strong> {permission}</p>
            
            {!isSubscribed && (
              <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>📢 Select Notification Channels</h3>
                <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#666' }}>
                  Choose which types of notifications you want to receive:
                </p>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {AVAILABLE_CHANNELS.map(channel => (
                    <label 
                      key={channel.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '0.5rem',
                        padding: '0.75rem',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        backgroundColor: selectedChannels.includes(channel.id) ? '#f0f9ff' : '#fafafa',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedChannels.includes(channel.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedChannels(prev => [...prev, channel.id])
                          } else {
                            setSelectedChannels(prev => prev.filter(id => id !== channel.id))
                          }
                        }}
                        style={{ marginTop: '0.2rem' }}
                      />
                      <div>
                        <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                          {channel.name}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>
                          {channel.description}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
            
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {!isSubscribed ? (
                <button 
                  onClick={handleSubscribe}
                  disabled={loading || selectedChannels.length === 0}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: selectedChannels.length === 0 ? '#ccc' : '#007FFF',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading || selectedChannels.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: loading || selectedChannels.length === 0 ? 0.6 : 1
                  }}
                >
                  {loading ? 'Subscribing...' : selectedChannels.length === 0 ? 'Select at least one channel' : 'Enable Notifications'}
                </button>
              ) : (
                <>
                  <button 
                    onClick={handleUnsubscribe}
                    disabled={loading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    {loading ? 'Unsubscribing...' : 'Disable Notifications'}
                  </button>
                  <button 
                    onClick={handleTestNotification}
                    disabled={loading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    {loading ? 'Sending...' : 'Send Test Notification'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>📱 Admin Panel Features</h2>
        <p>The notifications plugin adds the following to your Payload admin panel:</p>
        <ul>
          <li><strong>Notifications Collection:</strong> Create and manage notifications with rich text content</li>
          <li><strong>Push Subscriptions Collection:</strong> View and manage user push notification subscriptions (check here after subscribing!)</li>
          <li><strong>📢 Channel-Based Subscriptions:</strong> Users can subscribe to specific notification channels (General, Orders, Products, Marketing)</li>
          <li><strong>Read/Unread Tracking:</strong> Monitor which notifications have been read</li>
          <li><strong>User Targeting:</strong> Send notifications to specific users</li>
          <li><strong>🎯 Automatic Push Notifications:</strong> Push notifications are sent automatically when notifications are created!</li>
        </ul>
      </div>

      <div style={{ marginBottom: '2rem', padding: '1rem', border: '2px solid #28a745', borderRadius: '8px', backgroundColor: '#f8fff8' }}>
        <h2 style={{ color: '#28a745', marginBottom: '1rem' }}>🚀 Try Automatic Push Notifications</h2>
        <div style={{ padding: '0.75rem', backgroundColor: '#fff3cd', borderRadius: '4px', marginBottom: '1rem', border: '1px solid #ffeaa7' }}>
          <strong>⚠️ Important:</strong> You must be signed in to subscribe to push notifications. The subscription associates with your user account.
        </div>
        <p style={{ marginBottom: '1rem' }}>
          <strong>Step 1:</strong> <a href="/admin/login" target="_blank" style={{ color: '#007FFF' }}>Sign in to the admin panel</a> first (dev@payloadcms.com / test)
        </p>
        <p style={{ marginBottom: '1rem' }}>
          <strong>Step 2:</strong> Return here and subscribe to push notifications above ↑
        </p>
        <p style={{ marginBottom: '1rem' }}>
          <strong>Step 3:</strong> Go to the <a href="/admin" target="_blank" style={{ color: '#007FFF' }}>admin panel</a> and create a new notification
        </p>
        <p style={{ marginBottom: '1rem' }}>
          <strong>Step 4:</strong> Set the recipient to "customer@example.com" (the test user)
        </p>
        <p style={{ marginBottom: '1rem' }}>
          <strong>Step 5:</strong> Choose a notification channel (General, Orders, Products, or Marketing) - must match your subscription
        </p>
        <p style={{ marginBottom: '1rem' }}>
          <strong>Step 6:</strong> Save the notification and watch for an automatic push notification! 🎉
        </p>
        <div style={{ padding: '0.75rem', backgroundColor: '#e7f3ff', borderRadius: '4px', fontSize: '0.9rem' }}>
          <strong>💡 How it works:</strong> When you create a notification in the admin panel, the plugin automatically:
          <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            <li>Extracts the title and message content</li>
            <li>Finds all push subscriptions for the recipient</li>
            <li>Sends push notifications to their devices</li>
            <li>Handles errors gracefully without breaking the notification creation</li>
          </ul>
        </div>
      </div>

      <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>🚀 API Endpoints</h2>
        <p>The plugin automatically creates these API endpoints for web push:</p>
        <ul>
          <li><code>POST /api/push-notifications/subscribe</code> - Subscribe to push notifications</li>
          <li><code>POST /api/push-notifications/unsubscribe</code> - Unsubscribe from push notifications</li>
          <li><code>GET /api/push-notifications/vapid-public-key</code> - Get VAPID public key</li>
          <li><code>POST /api/push-notifications/send</code> - Send notification to user</li>
          <li><code>POST /api/push-notifications/test</code> - Send test notification (admin only)</li>
        </ul>
      </div>

      <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>💡 Getting Started</h2>
        <ol>
          <li>Generate VAPID keys: <code>npx web-push generate-vapid-keys</code></li>
          <li>Add the keys to your <code>.env</code> file</li>
          <li>Create a service worker at <code>/public/sw.js</code></li>
          <li>Use the client-side utilities to manage subscriptions</li>
          <li>Send notifications programmatically or via the admin panel</li>
        </ol>
      </div>

      <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
        <h3>📋 Sample Data</h3>
        <p>This demo includes:</p>
        <ul>
          <li>Sample users (admin and customer)</li>
          <li>Sample notifications demonstrating channels</li>
          <li>Push subscription management with channel filtering</li>
          <li>Automatic push notification hooks</li>
        </ul>
        <p>
          <strong>Login:</strong> dev@payloadcms.com / test<br/>
          <strong>Admin Panel:</strong> <a href="/admin" target="_blank">/admin</a>
        </p>
      </div>
    </div>
  )
}