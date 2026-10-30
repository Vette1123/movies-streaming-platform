import { beforeEach, describe, expect, it } from 'vitest'

import { createSession } from '@/lib/auth/session'
import { TRIAL_WINDOW_MS } from '@/lib/player-trial'
import {
  sweepPlayerTrials,
  ticketDenial,
  type TicketRequest,
} from '@/lib/pro/ticket-access'

import { addUser, sqliteD1 } from './helpers/sqlite-d1'

// A signed ticket is all the private player asks for, so this function IS the
// paywall. It runs against the real migrations.
describe('who gets a playback ticket', () => {
  let db: D1Database
  let count: (subject?: string) => number
  let supporter: string
  let free: string
  const now = Date.now()

  const ask = (overrides: Partial<TicketRequest>) =>
    ticketDenial(db, {
      bearer: null,
      cookie: null,
      ip: '203.0.113.7',
      secret: 'secret',
      media: 'movie:550',
      now,
      ...overrides,
    })

  beforeEach(async () => {
    const opened = sqliteD1('0001_accounts.sql', '0014_player_trials.sql')
    db = opened.db
    count = () =>
      Number(
        (
          opened.sqlite
            .prepare('SELECT count(*) AS n FROM player_trials')
            .get() as { n: number }
        ).n
      )
    addUser(opened.sqlite, 'supporter', 'pro')
    addUser(opened.sqlite, 'free', null)
    supporter = await createSession(db, 'supporter', now)
    free = await createSession(db, 'free', now)
  })

  it('always lets a supporter in, and spends no trial doing it', async () => {
    expect(await ask({ cookie: supporter })).toBeNull()
    expect(await ask({ cookie: supporter, media: 'movie:551' })).toBeNull()
    expect(await ask({ bearer: supporter, media: 'tv:1' })).toBeNull()
    expect(count()).toBe(0)
  })

  it('never gives a linked TV the trial', async () => {
    expect((await ask({ bearer: free }))?.status).toBe(402)
    expect(count()).toBe(0)
  })

  it('answers 401 to a dead bearer, so the TV knows to relink', async () => {
    expect((await ask({ bearer: 'not-a-session' }))?.status).toBe(401)
  })

  it('does not let a bad bearer fall back to the anonymous trial', async () => {
    expect(await ask({ bearer: 'nope', cookie: supporter })).not.toBeNull()
    expect(count()).toBe(0)
  })

  it('gives a free account one title, however many times it asks', async () => {
    expect(await ask({ cookie: free })).toBeNull()
    expect(await ask({ cookie: free })).toBeNull()
    expect((await ask({ cookie: free, media: 'movie:551' }))?.status).toBe(402)
  })

  it('gives a stranger one title, by address', async () => {
    expect(await ask({})).toBeNull()
    expect((await ask({ media: 'movie:551' }))?.status).toBe(402)
    // A different visitor is a different subject.
    expect(await ask({ ip: '203.0.113.8', media: 'movie:551' })).toBeNull()
  })

  it('never stores the address', async () => {
    await ask({})
    const held = await db
      .prepare('SELECT subject FROM player_trials WHERE expires_at > ?')
      .bind(now)
      .first<{ subject: string }>()
    expect(held?.subject).toMatch(/^ip:[0-9a-f]{64}$/)
  })

  it('refuses a stranger it cannot identify rather than opening up', async () => {
    expect((await ask({ ip: null }))?.status).toBe(402)
    expect((await ask({ secret: undefined }))?.status).toBe(402)
  })

  it('frees the next title after 24 hours, not before', async () => {
    await ask({})
    const almost = now + TRIAL_WINDOW_MS - 1
    expect((await ask({ media: 'movie:2', now: almost }))?.status).toBe(402)
    const after = now + TRIAL_WINDOW_MS
    expect(await ask({ media: 'movie:2', now: after })).toBeNull()
  })

  it('lets only one of two racing titles win', async () => {
    const [first, second] = await Promise.all([
      ask({ media: 'movie:1' }),
      ask({ media: 'movie:2' }),
    ])
    expect([first, second].filter((denial) => denial === null)).toHaveLength(1)
  })

  it('answers 503 rather than opening up with no database', async () => {
    const denied = await ticketDenial(undefined, {
      bearer: null,
      cookie: null,
      ip: '203.0.113.7',
      secret: 'secret',
      media: 'movie:550',
      now,
    })
    expect(denied?.status).toBe(503)
  })

  it('sweeps only what has expired', async () => {
    await ask({})
    await sweepPlayerTrials(db, now)
    expect(count()).toBe(1)
    await sweepPlayerTrials(db, now + TRIAL_WINDOW_MS)
    expect(count()).toBe(0)
  })
})
