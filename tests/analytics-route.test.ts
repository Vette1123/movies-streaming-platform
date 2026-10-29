import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const capture = vi.fn()

vi.mock('@/lib/posthog-client', () => ({
  ph: (
    fn: (posthog: { capture: typeof capture; register: () => void }) => void
  ) => fn({ capture, register: () => {} }),
}))

describe('track() route', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    }
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('sessionStorage', storage)
    capture.mockClear()
  })
  afterEach(() => vi.unstubAllGlobals())

  // The `route` super property is registered by the $pageview effect, which
  // can run AFTER the new page's own effects on a client navigation — so
  // media_detail_viewed on /movies/414906 went out as /movies/year/:year.
  it('stamps the route of the page the event fired on, not the last pageview', async () => {
    vi.stubGlobal('window', { location: { pathname: '/movies/414906' } })
    const { track } = await import('@/lib/analytics')
    track('media_detail_viewed', { media_id: 414906 })
    expect(capture).toHaveBeenCalledWith(
      'media_detail_viewed',
      expect.objectContaining({ route: '/movies/:id', media_id: 414906 })
    )
  })
})
