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
