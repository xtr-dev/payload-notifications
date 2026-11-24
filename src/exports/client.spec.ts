import { Script } from 'node:vm'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, test } from 'vitest'

import {
  serviceWorkerCode,
  usePushNotifications,
} from '@xtr-dev/payload-notifications/client'

describe('@xtr-dev/payload-notifications/client', () => {
  test('provides a working React hook through the public client entry point', () => {
    function Consumer() {
      const state = usePushNotifications('public-key', ['updates'])
      return createElement('span', null, String(state.isSupported))
    }

    expect(renderToString(createElement(Consumer))).toContain('false')
  })
})

describe('serviceWorkerCode', () => {
  test('parses as classic (non-module) script', () => {
    // A classic <script> and a browser service worker file both reject `import`/`export`.
    // new vm.Script throws SyntaxError if the source isn't valid as a non-module script,
    // which is exactly the constraint a copy-verbatim /public/sw.js is held to.
    expect(() => new Script(serviceWorkerCode)).not.toThrow()
  })

  test('contains no TypeScript-only syntax', () => {
    // These are the constructs that made the previous template fail when pasted into a
    // browser service worker: `declare const self`, an interface, a type annotation on the
    // push payload, and the module-only `export {}` used to scope the ambient declaration.
    expect(serviceWorkerCode).not.toMatch(/\bdeclare\s+const\b/)
    expect(serviceWorkerCode).not.toMatch(/\binterface\s+\w+/)
    expect(serviceWorkerCode).not.toMatch(/:\s*NotificationPayload\b/)
    expect(serviceWorkerCode).not.toMatch(/^export\s*\{\s*\}/m)
  })

  test('registers the expected service worker event listeners', () => {
    for (const eventName of ['install', 'activate', 'push', 'notificationclick', 'notificationclose']) {
      expect(serviceWorkerCode).toContain(`self.addEventListener('${eventName}'`)
    }
  })
})

// Runs serviceWorkerCode in a sandbox with a minimal fake ServiceWorkerGlobalScope,
// dispatches one push event, and returns the options passed to showNotification.
async function showNotificationOptionsFor(workerUrl: string, pushPayload: Record<string, unknown>) {
  const listeners: Record<string, (event: unknown) => void> = {}
  const shown: Array<{ options: Record<string, unknown>; title: string }> = []
  const self = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type] = listener
    },
    clients: { claim: () => Promise.resolve() },
    location: { href: workerUrl },
    registration: {
      showNotification: (title: string, options: Record<string, unknown>) => {
        shown.push({ options, title })
        return Promise.resolve()
      },
    },
    skipWaiting: () => undefined,
  }
  new Script(serviceWorkerCode).runInNewContext({ console, Date, self, URL })

  const pending: Promise<unknown>[] = []
  listeners.push({
    data: { json: () => pushPayload },
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
  })
  await Promise.all(pending)

  expect(shown).toHaveLength(1)
  return shown[0].options
}

describe('serviceWorkerCode icon and badge', () => {
  test('has no hardcoded icon or badge paths', () => {
    expect(serviceWorkerCode).not.toContain('/icon-192x192.png')
    expect(serviceWorkerCode).not.toContain('/badge-72x72.png')
  })

  test('uses the icon and badge from the push payload', async () => {
    const options = await showNotificationOptionsFor('https://example.com/sw.js?icon=/default.png&badge=/default-badge.png', {
      badge: '/payload-badge.png',
      body: 'Body',
      icon: '/payload-icon.png',
      title: 'Title',
    })
    expect(options).toMatchObject({ badge: '/payload-badge.png', icon: '/payload-icon.png' })
  })

  test('falls back to the icon and badge query parameters on the registration URL', async () => {
    const options = await showNotificationOptionsFor('https://example.com/sw.js?icon=/default.png&badge=/default-badge.png', {
      body: 'Body',
      title: 'Title',
    })
    expect(options).toMatchObject({ badge: '/default-badge.png', icon: '/default.png' })
  })

  test('shows no icon or badge when neither the payload nor the registration URL sets one', async () => {
    const options = await showNotificationOptionsFor('https://example.com/sw.js', { body: 'Body', title: 'Title' })
    expect(options.icon).toBeUndefined()
    expect(options.badge).toBeUndefined()
  })
})
