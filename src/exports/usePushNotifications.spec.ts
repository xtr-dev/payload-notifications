import { afterEach, describe, expect, test, vi } from 'vitest'

// The hook's subscription check runs inside useEffect, which server rendering
// never executes. React is mocked so the effect runs synchronously when the
// hook is called, and the push manager is mocked so isSubscribed() can reject.
vi.mock('react', () => ({
  useEffect: (effect: () => void) => effect(),
  useState: <T,>(initial: T) => [initial, () => {}],
}))

const isSubscribed = vi.fn<() => Promise<boolean>>()

vi.mock('../client/push-manager.js', () => ({
  ClientPushManager: class {
    getPermissionStatus = () => 'default'
    isSubscribed = isSubscribed
    isSupported = () => true
  },
}))

const { usePushNotifications } = await import('./client.js')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePushNotifications', () => {
  test('logs a rejected isSubscribed() check instead of leaving the rejection unhandled', async () => {
    const error = new Error('service worker unavailable')
    isSubscribed.mockRejectedValue(error)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)

    try {
      usePushNotifications('public-key', ['default'])
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(consoleError).toHaveBeenCalledWith('Failed to check push subscription status:', error)
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })
})
