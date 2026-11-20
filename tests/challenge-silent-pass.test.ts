import { isChallenged } from '@/scripts/lib/challenge.mjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isReplayable,
  safeReturnPath,
  SILENT_PASS_LANDING,
  SILENT_PASS_TIMEOUT_MS,
} from '@/lib/challenge-hop'

const ORIGIN = 'https://www.reely.space'

const challengedResponse = () =>
  new Response('challenge', {
    status: 403,
    headers: { 'cf-mitigated': 'challenge' },
  })

interface FakeFrame {
  src: string
  style: { cssText: string }
  title: string
  tabIndex: number
  onload: (() => void) | null
  contentWindow: { location: { pathname: string } } | null
  setAttribute: () => void
  remove: () => void
}

// A browser without a DOM: window.fetch, location, sessionStorage and the one
// iframe the silent pass creates. `solves` decides whether the frame ever
// lands on the static file (the challenge passed) or sits on the check.
function installFakeBrowser({ solves }: { solves: boolean }) {
  const frames: FakeFrame[] = []
  const assign = vi.fn()
  const store = new Map<string, string>()
  let passed = false
  const network = vi.fn(async () =>
    passed ? new Response('[]', { status: 200 }) : challengedResponse()
  )
  vi.stubGlobal('window', {
    fetch: network,
    location: {
      origin: ORIGIN,
      pathname: '/movies',
      search: '',
      hash: '',
      assign,
    },
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    },
  })
  vi.stubGlobal('document', {
    createElement: () => {
      const frame: FakeFrame = {
        src: '',
        style: { cssText: '' },
        title: '',
        tabIndex: 0,
        onload: null,
        contentWindow: { location: { pathname: '/api/verify' } },
        setAttribute: () => {},
        remove: () => {},
      }
      frames.push(frame)
      return frame
    },
    body: {
      appendChild: (frame: FakeFrame) => {
        // The challenge page loads first, then (when solved) the landing.
        setTimeout(() => frame.onload?.(), 100)
        if (solves) {
          setTimeout(() => {
            passed = true
            frame.contentWindow = {
              location: { pathname: SILENT_PASS_LANDING },
            }
            frame.onload?.()
          }, 4000)
        }
      },
    },
  })
  return { frames, assign }
}

describe('the challenge is passed without leaving the page', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('solves in a hidden frame and hands the caller the retried answer', async () => {
    const browser = installFakeBrowser({ solves: true })
    const { installChallengeHop } = await import('@/lib/challenge-hop')
    installChallengeHop()
    const pending = window.fetch('/api/genres?type=movie')
    await vi.advanceTimersByTimeAsync(5000)
    const res = await pending
    expect(res.status).toBe(200)
    expect(browser.assign).not.toHaveBeenCalled()
    expect(browser.frames).toHaveLength(1)
    expect(browser.frames[0].src).toBe(
      `/api/verify?next=${encodeURIComponent(SILENT_PASS_LANDING)}`
    )
  })

  it('shares one frame between requests challenged together', async () => {
    const browser = installFakeBrowser({ solves: true })
    const { installChallengeHop } = await import('@/lib/challenge-hop')
    installChallengeHop()
    const both = Promise.all([
      window.fetch('/api/genres'),
      window.fetch('/api/watch-providers'),
    ])
    await vi.advanceTimersByTimeAsync(5000)
    expect((await both).map((r) => r.status)).toEqual([200, 200])
    expect(browser.frames).toHaveLength(1)
  })

  it('falls back to the visible hop when the check wants a click', async () => {
    const browser = installFakeBrowser({ solves: false })
    const { installChallengeHop } = await import('@/lib/challenge-hop')
    installChallengeHop()
    const pending = window.fetch('/api/search?q=dune')
    await vi.advanceTimersByTimeAsync(SILENT_PASS_TIMEOUT_MS + 100)
    expect((await pending).status).toBe(403)
    expect(browser.assign).toHaveBeenCalledWith('/api/verify?next=%2Fmovies')
  })
})

describe('the silent pass target', () => {
  it('lands on a static file that is never challenged', () => {
    expect(safeReturnPath(SILENT_PASS_LANDING)).toBe(SILENT_PASS_LANDING)
    expect(
      isChallenged({ path: SILENT_PASS_LANDING, verifiedBot: false })
    ).toBe(false)
  })

  it('replays only a request it can send again unchanged', () => {
    expect(isReplayable('/api/genres')).toBe(true)
    expect(isReplayable('/api/x', { method: 'POST', body: '{}' })).toBe(true)
    expect(isReplayable('/api/x', { body: new Blob(['x']) })).toBe(false)
    expect(isReplayable(new Request(`${ORIGIN}/api/genres`))).toBe(true)
  })
})
