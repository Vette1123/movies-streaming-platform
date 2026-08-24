import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  __clearTicketCache,
  ticketFor,
  warmReelyTicket,
} from '@/lib/pro/ticket-cache'

// The whole point of the cache is that pressing play does not pay for a
// round trip that hovering already paid for — and that a stale or failed
// ticket is never handed to the player.

const target = { type: 'movie' as const, id: 603, title: 'The Matrix' }

const ok = (url: string) =>
  ({ ok: true, json: async () => ({ url }) }) as unknown as Response

let calls: number

beforeEach(() => {
  __clearTicketCache()
  calls = 0
  vi.useFakeTimers()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      calls += 1
      return ok(`https://play.example/p?n=${calls}`)
    })
  )
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('ticketFor', () => {
  it('serves a warm ticket without a second request', async () => {
    warmReelyTicket(target)
    const url = await ticketFor(target)
    expect(url).toBe('https://play.example/p?n=1')
    expect(calls).toBe(1)
  })

  it('mints again once the entry is older than the freshness window', async () => {
    await ticketFor(target)
    vi.advanceTimersByTime(46000)
    expect(await ticketFor(target)).toBe('https://play.example/p?n=2')
    expect(calls).toBe(2)
  })

  it('keeps tickets for different episodes apart', async () => {
    const ep = { type: 'tv' as const, id: 1399, season: 1, episode: 2 }
    await ticketFor(target)
    await ticketFor(ep)
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
    await expect(ticketFor(target)).rejects.toThrow('ticket 503')
    // Same tick, so only the eviction — not the clock — can save this.
    expect(await ticketFor(target)).toBe('https://play.example/p?n=2')
  })

  it('never throws out of the warm path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )
    expect(() => warmReelyTicket(target)).not.toThrow()
    await expect(ticketFor(target)).rejects.toThrow('offline')
  })
})
