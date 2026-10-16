import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  dropWarmTickets,
  resolveUrlOf,
  takeTicket,
  warmReelyTicket,
} from '@/lib/pro/ticket-cache'

// The whole point of the cache is that pressing play does not pay for a
// round trip that hovering already paid for — and that a stale or failed
// ticket is never handed to the player.

const target = { type: 'movie' as const, id: 603, title: 'The Matrix' }

const ok = (url: string) =>
  ({ ok: true, json: async () => ({ url }) }) as unknown as Response

let calls: number
/** Stream lookups started on intent, as [url, init]. */
let walks: [string, RequestInit | undefined][]

/** A fetch that mints `ticketUrl(n)` and records every stream lookup apart. */
const stubFetch = (ticketUrl: (n: number) => string) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      if (input.includes('/api/stream/resolve')) {
        walks.push([input, init])
        return { ok: true } as Response
      }
      calls += 1
      return ok(ticketUrl(calls))
    })
  )

beforeEach(() => {
  dropWarmTickets()
  calls = 0
  walks = []
  vi.useFakeTimers()
  stubFetch((n) => `https://play.example/p?n=${n}`)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('takeTicket', () => {
  it('serves a warm ticket without a second request', async () => {
    warmReelyTicket(target)
    const url = await takeTicket(target)
    expect(url).toBe('https://play.example/p?n=1')
    expect(calls).toBe(1)
  })

  it('spends it: a second mount of the same title mints its own', async () => {
    // The settings gear remounts the player. Reusing the first boot's URL
    // brought back the old subtitles AND the old start position, so the
    // episode restarted from wherever the first boot began.
    warmReelyTicket(target)
    expect(await takeTicket(target)).toBe('https://play.example/p?n=1')
    expect(await takeTicket(target)).toBe('https://play.example/p?n=2')
  })

  it('drops warm tickets when a playback setting changes', async () => {
    warmReelyTicket(target)
    dropWarmTickets()
    expect(await takeTicket(target)).toBe('https://play.example/p?n=2')
  })

  it('mints again once the entry is older than the freshness window', async () => {
    await takeTicket(target)
    vi.advanceTimersByTime(46000)
    expect(await takeTicket(target)).toBe('https://play.example/p?n=2')
    expect(calls).toBe(2)
  })

  it('keeps tickets for different episodes apart', async () => {
    const ep = { type: 'tv' as const, id: 1399, season: 1, episode: 2 }
    await takeTicket(target)
    await takeTicket(ep)
    expect(calls).toBe(2)
  })

  it('drops a failure so the next attempt is a real one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1
        if (calls === 1) return { ok: false, status: 503 } as Response
        return ok('https://play.example/p?n=2')
      })
    )
    await expect(takeTicket(target)).rejects.toThrow('ticket 503')
    // Same tick, so only the eviction — not the clock — can save this.
    expect(await takeTicket(target)).toBe('https://play.example/p?n=2')
  })

  it('never throws out of the warm path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )
    expect(() => warmReelyTicket(target)).not.toThrow()
    await expect(takeTicket(target)).rejects.toThrow('offline')
  })
})

describe('stream lookup on intent', () => {
  // A title nobody had played in the last hour cost a ~1.2s provider walk that
  // only began after the tap, the iframe, the shell and the bundle. Asked on
  // intent, the relay finishes (and caches) it while the visitor decides.
  const episode = { type: 'tv' as const, id: 1396, season: 2, episode: 3 }

  beforeEach(() =>
    stubFetch(
      (n) =>
        `https://play.example/play?type=tv&id=1396&t=tk${n}&o=https%3A%2F%2Freely.space&start=0&title=BB&season=2&episode=3`
    )
  )

  const settle = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  }

  it('asks the player for the stream as soon as the ticket exists', async () => {
    warmReelyTicket(episode)
    await settle()
    expect(walks).toHaveLength(1)
    const [url, init] = walks[0]
    expect(url).toBe(
      'https://play.example/api/stream/resolve?type=tv&id=1396&season=2&episode=3&t=tk1'
    )
    expect(init).toMatchObject({ mode: 'no-cors', credentials: 'omit' })
  })

  it('walks once per ticket, however often the pointer comes back', async () => {
    warmReelyTicket(episode)
    warmReelyTicket(episode)
    await settle()
    warmReelyTicket(episode)
    await settle()
    expect(calls).toBe(1)
    expect(walks).toHaveLength(1)
  })

  it('leaves the lookup to the player when its mount mints the ticket', async () => {
    await takeTicket(episode)
    await settle()
    expect(walks).toHaveLength(0)
  })
})

describe('resolveUrlOf', () => {
  it('copies a film ticket without season or episode', () => {
    expect(
      resolveUrlOf('https://play.example/play?type=movie&id=603&t=abc&start=40')
    ).toBe('https://play.example/api/stream/resolve?type=movie&id=603&t=abc')
  })

  it('refuses a URL that names no title or carries no ticket', () => {
    expect(resolveUrlOf('https://play.example/p?n=1')).toBeNull()
    expect(
      resolveUrlOf('https://play.example/play?type=movie&id=603')
    ).toBeNull()
    expect(resolveUrlOf('not a url')).toBeNull()
  })
})
