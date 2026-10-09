import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const capture = vi.fn()

vi.mock('@/lib/posthog-client', () => ({
  ph: (fn: (posthog: { capture: typeof capture }) => void) => fn({ capture }),
}))

describe('trackPwaInstallable', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('window', {})
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
    capture.mockClear()
  })
  afterEach(() => vi.unstubAllGlobals())

  // Chrome re-fires beforeinstallprompt on every full page load; PostHog was
  // counting ~5 "installable" per person.
  it('counts once per tab session, however often the browser fires', async () => {
    const { trackPwaInstallable } = await import('@/lib/analytics')
    trackPwaInstallable()
    trackPwaInstallable()
    trackPwaInstallable()
    expect(capture).toHaveBeenCalledTimes(1)
    expect(capture).toHaveBeenCalledWith('pwa_installable', undefined)
  })

  it('still counts when storage is blocked', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
    })
    const { trackPwaInstallable } = await import('@/lib/analytics')
    trackPwaInstallable()
    expect(capture).toHaveBeenCalledTimes(1)
  })
})
