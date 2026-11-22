import { isChallenged } from '@/scripts/lib/challenge.mjs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isReplayable,
  type PassOutcome,
  safeReturnPath,
  SHOWN_CHECK_TIMEOUT_MS,
  SILENT_PASS_LANDING,
  SILENT_PASS_TIMEOUT_MS,
} from '@/lib/challenge-hop'

const ORIGIN = 'https://www.reely.space'

const challengedResponse = () =>
  new Response('challenge', {
    status: 403,
    headers: { 'cf-mitigated': 'challenge' },
  })

interface FakeEl {
  tag: string
  src: string
  style: { cssText: string }
  title: string
  tabIndex: number
  type: string
  textContent: string
  attrs: Map<string, string>
  children: FakeEl[]
  onload: (() => void) | null
  onclick: (() => void) | null
  contentWindow: { location: { pathname: string } } | null
  appendChild: (c: FakeEl) => void
  insertBefore: (c: FakeEl) => void
  setAttribute: (k: string, v: string) => void
  removeAttribute: (k: string) => void
  remove: () => void
}

const fakeEl = (tag: string): FakeEl => {
  const el: FakeEl = {
    tag,
    src: '',
    style: { cssText: '' },
    title: '',
    tabIndex: 0,
    type: '',
    textContent: '',
    attrs: new Map(),
    children: [],
    onload: null,
    onclick: null,
    contentWindow: { location: { pathname: '/api/verify' } },
    appendChild: (c) => void el.children.push(c),
    insertBefore: (c) => void el.children.unshift(c),
    setAttribute: (k, v) => void el.attrs.set(k, v),
    removeAttribute: (k) => void el.attrs.delete(k),
    remove: () => {},
  }
  return el
}

const findAll = (el: FakeEl, tag: string): FakeEl[] => [
  ...(el.tag === tag ? [el] : []),
  ...el.children.flatMap((c) => findAll(c, tag)),
]

// A browser without a DOM: window.fetch, location, sessionStorage and the one
// check the pass mounts. `solvesAt` is when (ms after mounting) the frame lands
// on the static file, i.e. the challenge passed; undefined means never.
function installFakeBrowser({ solvesAt }: { solvesAt?: number }) {
  const frames: FakeEl[] = []
  const wraps: FakeEl[] = []
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
    createElement: (tag: string) => fakeEl(tag),
    body: {
      appendChild: (wrap: FakeEl) => {
        wraps.push(wrap)
        const [frame] = findAll(wrap, 'iframe')
        frames.push(frame)
        // The challenge page loads first, then (when solved) the landing.
        setTimeout(() => frame.onload?.(), 100)
        if (solvesAt !== undefined) {
          setTimeout(() => {
            passed = true
            frame.contentWindow = {
              location: { pathname: SILENT_PASS_LANDING },
            }
            frame.onload?.()
          }, solvesAt)
        }
      },
    },
  })
  return { frames, wraps, assign, network }
}

const outcomes = () => {
  const seen: PassOutcome[] = []
  return { seen, report: (o: PassOutcome) => void seen.push(o) }
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
    const browser = installFakeBrowser({ solvesAt: 4000 })
    const { seen, report } = outcomes()
    const { installChallengeHop } = await import('@/lib/challenge-hop')
    installChallengeHop(report)
    const pending = window.fetch('/api/genres?type=movie')
    await vi.advanceTimersByTimeAsync(5000)
    const res = await pending
    expect(res.status).toBe(200)
    expect(browser.assign).not.toHaveBeenCalled()
    expect(browser.frames).toHaveLength(1)
    expect(browser.frames[0].src).toBe(
      `/api/verify?next=${encodeURIComponent(SILENT_PASS_LANDING)}`
    )
    expect(browser.wraps[0].attrs.get('role')).toBeUndefined()
    expect(seen).toEqual([{ how: 'hidden', ok: true, ms: 4000 }])
  })

  it('shares one frame between requests challenged together', async () => {
    const browser = installFakeBrowser({ solvesAt: 4000 })
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

  // 2026-11-22: the hidden frame solved for 5 of 15 IPs; the rest hopped away
  // and many never came back. A check that wants a click is now shown in place.
  it('shows a slow check in place, and a click there passes it', async () => {
    const browser = installFakeBrowser({
      solvesAt: SILENT_PASS_TIMEOUT_MS + 5000,
    })
    const { seen, report } = outcomes()
    const { installChallengeHop } = await import('@/lib/challenge-hop')
    installChallengeHop(report)
    const pending = window.fetch('/api/search?q=dune')
    await vi.advanceTimersByTimeAsync(SILENT_PASS_TIMEOUT_MS + 100)
    expect(browser.wraps[0].attrs.get('role')).toBe('dialog')
    expect(browser.frames[0].tabIndex).toBe(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect((await pending).status).toBe(200)
    expect(browser.assign).not.toHaveBeenCalled()
    expect(seen.map((o) => [o.how, o.ok])).toEqual([['shown', true]])
  })

  it('"Not now" closes the check, never hops, and is not asked again this visit', async () => {
    const browser = installFakeBrowser({})
    const { seen, report } = outcomes()
    const { installChallengeHop } = await import('@/lib/challenge-hop')
    installChallengeHop(report)
    const pending = window.fetch('/api/search?q=dune')
    await vi.advanceTimersByTimeAsync(SILENT_PASS_TIMEOUT_MS + 100)
    const [later] = findAll(browser.wraps[0], 'button')
    later.onclick?.()
    expect((await pending).status).toBe(403)
    expect((await window.fetch('/api/genres')).status).toBe(403)
    expect(browser.frames).toHaveLength(1)
    expect(browser.assign).not.toHaveBeenCalled()
    expect(seen.map((o) => o.how)).toEqual(['dismissed'])
  })

  it('hops visibly only after the shown check also runs out', async () => {
    const browser = installFakeBrowser({})
    const { seen, report } = outcomes()
    const { installChallengeHop } = await import('@/lib/challenge-hop')
    installChallengeHop(report)
    const pending = window.fetch('/api/search?q=dune')
    await vi.advanceTimersByTimeAsync(SILENT_PASS_TIMEOUT_MS + 100)
    expect(browser.assign).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(SHOWN_CHECK_TIMEOUT_MS)
    expect((await pending).status).toBe(403)
    expect(browser.assign).toHaveBeenCalledWith('/api/verify?next=%2Fmovies')
    expect(seen.map((o) => [o.how, o.ok])).toEqual([
      ['shown', false],
      ['hop', true],
    ])
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
