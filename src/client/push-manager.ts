/**
 * Client-side Push Notification Manager
 * Handles subscription, permission requests, and communication with the server
 * 
 * @description This module is designed to run in browser environments only
 */

export interface PushSubscriptionData {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined'

export class ClientPushManager {
  private vapidPublicKey: string
  private serviceWorkerPath: string
  private apiEndpoint: string

  constructor(
    vapidPublicKey: string,
    options: {
      serviceWorkerPath?: string
      apiEndpoint?: string
    } = {}
  ) {
    this.vapidPublicKey = vapidPublicKey
    this.serviceWorkerPath = options.serviceWorkerPath || '/sw.js'
    this.apiEndpoint = options.apiEndpoint || '/api/push-notifications'
  }

  /**
   * Check if push notifications are supported
   */
  public isSupported(): boolean {
    if (!isBrowser) return false
    
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    )
  }

  /**
   * Check current notification permission status
   */
  public getPermissionStatus(): NotificationPermission {
    if (!isBrowser || typeof Notification === 'undefined') return 'default'
    return Notification.permission
  }

  /**
   * Request notification permission from user
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported')
    }

    const permission = await Notification.requestPermission()
    return permission
  }

  /**
   * Register service worker
   */
  public async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    if (!isBrowser || !('serviceWorker' in navigator)) {
      throw new Error('Service workers are not supported')
    }

    try {
      const registration = await navigator.serviceWorker.register(this.serviceWorkerPath)
      console.log('Service worker registered:', registration)
      return registration
    } catch (error) {
      console.error('Service worker registration failed:', error)
      throw error
    }
  }

  /**
   * Subscribe to push notifications
   */
  public async subscribe(): Promise<PushSubscriptionData> {
    // Check support
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported')
    }

    // Request permission
    const permission = await this.requestPermission()
    if (permission !== 'granted') {
      throw new Error('Notification permission not granted')
    }

    // Register service worker
    const registration = await this.registerServiceWorker()

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready

    // Subscribe to push notifications
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey),
    })

    const subscriptionData: PushSubscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
      },
    }

    // Send subscription to server
    await this.sendSubscriptionToServer(subscriptionData)

    return subscriptionData
  }

  /**
   * Unsubscribe from push notifications
   */
  public async unsubscribe(): Promise<void> {
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      return
    }

    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      return
    }

    // Unsubscribe from push service
    await subscription.unsubscribe()

    // Notify server
    await this.sendUnsubscribeToServer(subscription.endpoint)
  }

  /**
   * Get current push subscription
   */
  public async getSubscription(): Promise<PushSubscriptionData | null> {
    if (!isBrowser || !('serviceWorker' in navigator)) return null
    
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      return null
    }

    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      return null
    }

    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
      },
    }
  }

  /**
   * Check if user is currently subscribed
   */
  public async isSubscribed(): Promise<boolean> {
    if (!isBrowser) return false
    const subscription = await this.getSubscription()
    return subscription !== null
  }

  /**
   * Send subscription data to server
   */
  private async sendSubscriptionToServer(subscription: PushSubscriptionData): Promise<void> {
    try {
      const response = await fetch(`${this.apiEndpoint}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription,
          userAgent: navigator.userAgent,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to subscribe: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to send subscription to server:', error)
      throw error
    }
  }

  /**
   * Send unsubscribe request to server
   */
  private async sendUnsubscribeToServer(endpoint: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiEndpoint}/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ endpoint }),
      })

      if (!response.ok) {
        throw new Error(`Failed to unsubscribe: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to send unsubscribe to server:', error)
      throw error
    }
  }

  /**
   * Convert VAPID public key to Uint8Array
   */
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

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('')
    return window.btoa(binary)
  }
}