import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Order of everything that touched the fake posthog-js.
const calls: string[] = []

vi.mock('posthog-js', () => ({
  default: {
    init: () => calls.push('init'),
    register: () => calls.push('register'),
    capture: () => calls.push('capture'),
  },
}))

describe('posthog-client', () => {
  beforeEach(() => {
    calls.length = 0
    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test')
    vi.stubGlobal('window', {
      location: { hostname: 'www.reely.space' },
      innerWidth: 390,
      innerHeight: 844,
    })
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      webdriver: false,
      language: 'en-US',
    })
    vi.stubGlobal('screen', { width: 390, height: 844 })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  // 830 of ~840 people had no app_version: the queue replayed register() into
  // an instance that init() had not touched yet.
  it('initialises before replaying anything queued during page load', async () => {
    const client = await import('@/lib/posthog-client')
    client.setPostHogInitializer((posthog) => posthog.init('phc_test'))
    client.ph((posthog) => posthog.register({ app_version: 'abc' }))
    client.ph((posthog) => posthog.capture('media_played'))
    await client.loadPostHog()
    expect(calls).toEqual(['init', 'register', 'capture'])
  })

  it('an error boundary loading it first still gets an initialised instance', async () => {
    const client = await import('@/lib/posthog-client')
    client.setPostHogInitializer((posthog) => posthog.init('phc_test'))
    const posthog = await client.loadPostHog()
    posthog?.capture('$exception')
    await client.loadPostHog()
    expect(calls).toEqual(['init', 'capture'])
  })
})
