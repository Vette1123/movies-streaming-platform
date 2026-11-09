import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSession } from '@/lib/auth/session'
import { TRIAL_WINDOW_MS } from '@/lib/player-trial'
import {
  releaseTrial,
  ticketDenial,
  type TicketRequest,
} from '@/lib/pro/ticket-access'

import { addUser, sqliteD1 } from './helpers/sqlite-d1'

// The trial is taken at mint, before anybody knows whether a stream exists. A
// refund is a paywall decision too: whoever can trigger it can watch for free.
describe('handing back a trial the provider could not serve', () => {
  let db: D1Database
  let free: string
  let supporter: string
  const now = Date.now()

  const request = (overrides: Partial<TicketRequest> = {}): TicketRequest => ({
    bearer: null,
    cookie: null,
    ip: '203.0.113.7',
    secret: 'secret',
    media: 'movie:1411621',
    now,
    ...overrides,
  })
  const noStream = () => Promise.resolve(true)
  const hasStream = () => Promise.resolve(false)

  beforeEach(async () => {
    const opened = sqliteD1(
      '0001_accounts.sql',
      '0014_player_trials.sql',
      '0015_pro_until.sql'
    )
    db = opened.db
    addUser(opened.sqlite, 'supporter', 'pro')
    addUser(opened.sqlite, 'free', null)
    supporter = await createSession(db, 'supporter', now)
    free = await createSession(db, 'free', now)
  })

  it('gives a stranger their title back, so another one plays today', async () => {
    expect(await ticketDenial(db, request())).toBeNull()
    expect(await releaseTrial(db, request(), noStream)).toBe(true)
    expect(await ticketDenial(db, request({ media: 'movie:550' }))).toBeNull()
  })

  it('gives a free account its title back', async () => {
    expect(await ticketDenial(db, request({ cookie: free }))).toBeNull()
    expect(await releaseTrial(db, request({ cookie: free }), noStream)).toBe(
      true
    )
    expect(
      await ticketDenial(db, request({ cookie: free, media: 'movie:550' }))
    ).toBeNull()
  })

  it('keeps the trial when the provider has the title', async () => {
    await ticketDenial(db, request())
    expect(await releaseTrial(db, request(), hasStream)).toBe(false)
    expect(
      (await ticketDenial(db, request({ media: 'movie:550' })))?.status
    ).toBe(402)
  })

  it('never releases a title the caller does not hold, and never asks the provider', async () => {
    await ticketDenial(db, request({ media: 'movie:550' }))
    const probe = vi.fn(noStream)
    expect(await releaseTrial(db, request(), probe)).toBe(false)
    expect(probe).not.toHaveBeenCalled()
    // Somebody else's address cannot release this one either.
    expect(
      await releaseTrial(
        db,
        request({ media: 'movie:550', ip: '198.51.100.1' }),
        probe
      )
    ).toBe(false)
    expect(probe).not.toHaveBeenCalled()
  })

  it('does not release an expired trial', async () => {
    await ticketDenial(db, request())
    const later = now + TRIAL_WINDOW_MS + 1
    expect(await releaseTrial(db, request({ now: later }), noStream)).toBe(
      false
    )
  })

  it('has nothing to release for a supporter or a linked TV', async () => {
    const probe = vi.fn(noStream)
    expect(await releaseTrial(db, request({ cookie: supporter }), probe)).toBe(
      false
    )
    expect(await releaseTrial(db, request({ bearer: free }), probe)).toBe(false)
    expect(probe).not.toHaveBeenCalled()
  })

  it('releases once: a replayed request finds nothing to give back', async () => {
    await ticketDenial(db, request())
    expect(await releaseTrial(db, request(), noStream)).toBe(true)
    expect(await releaseTrial(db, request(), noStream)).toBe(false)
  })
})
