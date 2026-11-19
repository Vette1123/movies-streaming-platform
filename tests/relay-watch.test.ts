import { describe, expect, it } from 'vitest'

import {
  classify,
  composeMessage,
  decide,
  probeHome,
  RE_ALERT_MS,
  runRelayWatch,
  type ChainState,
  type WatchState,
} from '@/lib/relay-watch'

// The watchdog mails a human. Two ways to get it badly wrong: page every five
// minutes (which teaches the human to ignore it) or stay quiet after forgetting
// a state (which is the outage nobody hears about). These pin both, plus the
// exact edge where the fallback dies alone - the rot the hourly canary cannot
// see because it short-circuits on the primary.

const UP = { up: true, detail: '200 ok' }
const DOWN = { up: false, detail: 'HTTP 502: Bad Gateway' }
const HOUR = 60 * 60 * 1000
const START = Date.UTC(2026, 10, 19, 9, 0, 0)

const stored = (
  state: ChainState,
  since: number,
  notifiedAt: number
): WatchState => ({ state, since, notifiedAt })

/** The notify branch, narrowed - a silent decision fails the test here. */
const notified = (decision: ReturnType<typeof decide>) => {
  if (!decision.notify) throw new Error('expected a notification')
  return decision
}

describe('classify', () => {
  it('names each of the four combinations', () => {
    expect(classify(UP, UP)).toBe('healthy')
    expect(classify(UP, DOWN)).toBe('primary-only')
    expect(classify(DOWN, UP)).toBe('fallback-only')
    expect(classify(DOWN, DOWN)).toBe('down')
  })
})

describe('decide', () => {
  it('arms on the first sight, even when both homes are up', () => {
    const decision = notified(decide(null, 'healthy', START))
    expect(decision.notify).toBe(true)
    expect(decision.reason).toBe('armed')
    expect(decision.next).toEqual({
      state: 'healthy',
      since: START,
      notifiedAt: START,
    })
  })

  it('is silent while healthy, forever', () => {
    const prev = stored('healthy', START - 365 * 24 * HOUR, START)
    const decision = decide(prev, 'healthy', START + 50 * HOUR)
    expect(decision.notify).toBe(false)
    expect(decision.next).toBe(prev)
  })

  it('mails once on a change and records when the state began', () => {
    const prev = stored('healthy', 0, START - HOUR)
    const decision = notified(decide(prev, 'fallback-only', START))
    expect(decision.notify).toBe(true)
    expect(decision.reason).toBe('changed')
    expect(decision.next).toEqual({
      state: 'fallback-only',
      since: START,
      notifiedAt: START,
    })
  })

  it('mails again on recovery, then goes quiet', () => {
    const recovered = notified(
      decide(stored('down', START - HOUR, START - HOUR), 'healthy', START)
    )
    expect(recovered.notify).toBe(true)
    expect(recovered.reason).toBe('changed')
    const quiet = decide(recovered.next, 'healthy', START + HOUR)
    expect(quiet.notify).toBe(false)
  })

  it('repeats a total outage every half hour, not sooner', () => {
    const prev = stored('down', START, START)
    expect(decide(prev, 'down', START + 29 * 60 * 1000).notify).toBe(false)
    const due = notified(decide(prev, 'down', START + 30 * 60 * 1000))
    expect(due.notify).toBe(true)
    expect(due.reason).toBe('repeat')
    // A repeat keeps `since` (when it broke) and moves only `notifiedAt`.
    expect(due.next.since).toBe(START)
    expect(due.next.notifiedAt).toBe(START + 30 * 60 * 1000)
  })

  it('keeps the fallback-only reminder at six hours', () => {
    const prev = stored('fallback-only', START, START)
    expect(decide(prev, 'fallback-only', START + 5 * HOUR).notify).toBe(false)
    expect(decide(prev, 'fallback-only', START + 6 * HOUR).notify).toBe(true)
  })

  it('keeps the missing-fallback reminder at a day', () => {
    const prev = stored('primary-only', START, START)
    expect(decide(prev, 'primary-only', START + 23 * HOUR).notify).toBe(false)
    expect(decide(prev, 'primary-only', START + 24 * HOUR).notify).toBe(true)
  })

  it('has a finite repeat for every broken state and none for healthy', () => {
    expect(RE_ALERT_MS.healthy).toBe(Number.POSITIVE_INFINITY)
    for (const state of ['primary-only', 'fallback-only', 'down'] as const) {
      expect(RE_ALERT_MS[state]).toBeGreaterThan(0)
      expect(Number.isFinite(RE_ALERT_MS[state])).toBe(true)
    }
  })
})

describe('probeHome', () => {
  const answer = (body: string, status = 200) =>
    (async () => new Response(body, { status })) as unknown as typeof fetch

  it('reads the relay health answer', async () => {
    expect(await probeHome('https://relay.reely.space/', answer('ok'))).toEqual(
      {
        up: true,
        detail: '200 ok',
      }
    )
  })

  it('reads a paused site page as down, quoting it', async () => {
    const probe = await probeHome(
      'https://relay-b.reely.space',
      answer('<html>Site not found</html>', 404)
    )
    expect(probe.up).toBe(false)
    expect(probe.detail).toContain('404')
  })

  it('reads a thrown fetch as down instead of throwing', async () => {
    const failing = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    const probe = await probeHome('https://relay.reely.space', failing)
    expect(probe.up).toBe(false)
    expect(probe.detail).toContain('fetch failed')
  })
})

describe('composeMessage', () => {
  const base = {
    previous: 'healthy' as ChainState,
    reason: 'changed' as const,
    since: START,
    now: START + 5 * 60 * 1000,
    primary: UP,
    fallback: DOWN,
  }

  it('names the state, both homes and the remedy', () => {
    const mail = composeMessage({ ...base, state: 'primary-only' })
    expect(mail.subject).toContain('fallback')
    expect(mail.text).toContain('relay.reely.space')
    expect(mail.text).toContain('relay-b.reely.space')
    expect(mail.text).toContain('HTTP 502')
    // relay-b is the Oracle VM: its outage is fixed on the VM, not by a
    // Netlify deploy (the remedies were once swapped).
    expect(mail.text).toContain('systemctl')
    expect(mail.text).not.toContain('npm run deploy')
    expect(mail.text).not.toContain('undefined')
  })

  it('sends a dead primary to the Netlify remedy', () => {
    const mail = composeMessage({
      ...base,
      state: 'fallback-only',
      primary: DOWN,
      fallback: UP,
    })
    expect(mail.text).toContain('npm run deploy')
    expect(mail.text).not.toContain('systemctl')
  })

  it('says a total outage in the subject', () => {
    const mail = composeMessage({
      ...base,
      state: 'down',
      primary: DOWN,
      fallback: DOWN,
    })
    expect(mail.subject).toContain('DOWN')
    expect(mail.text).toContain('No film plays')
  })

  it('marks the armed mail as such', () => {
    const mail = composeMessage({
      ...base,
      state: 'healthy',
      reason: 'armed',
      previous: null,
    })
    expect(mail.text).toContain('armed')
    expect(mail.subject).toContain('healthy')
  })
})

/** Just enough D1 for one row: the two statements this watcher issues. */
function fakeDb(
  initial: { state: string; since: number; notified_at: number } | null
) {
  let row = initial
  return {
    get row() {
      return row
    },
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            first: async () => (/^select/i.test(sql) ? row : null),
            run: async () => {
              row = {
                state: String(args[1]),
                since: Number(args[2]),
                notified_at: Number(args[3]),
              }
              return { success: true }
            },
          }
        },
      }
    },
  } as unknown as D1Database & { readonly row: unknown }
}

const bothUp = (async () => new Response('ok')) as unknown as typeof fetch
const primaryDown = (async (url: string) =>
  new Response(String(url).includes('relay-b') ? 'ok' : 'down', {
    status: String(url).includes('relay-b') ? 200 : 503,
  })) as unknown as typeof fetch

describe('runRelayWatch', () => {
  it('mails and records on the first tick, then stays quiet', async () => {
    const db = fakeDb(null)
    const sent: { subject: string; to: string }[] = []
    const env = {
      DB: db,
      ALERT_EMAIL_TO: 'owner@example.test',
      ALERT_EMAIL: {
        send: async (m: { subject: string; to: string }) => {
          sent.push(m)
        },
      },
    }
    const first = await runRelayWatch(env, START, bothUp)
    expect(first).toMatchObject({
      state: 'healthy',
      notified: true,
      reason: 'armed',
    })
    expect(sent).toHaveLength(1)
    expect(db.row).toMatchObject({ state: 'healthy', since: START })

    const second = await runRelayWatch(env, START + 5 * 60 * 1000, bothUp)
    expect(second).toMatchObject({ state: 'healthy', notified: false })
    expect(sent).toHaveLength(1)
  })

  it('does not advance the row when the send fails', async () => {
    const db = fakeDb(null)
    const env = {
      DB: db,
      ALERT_EMAIL_TO: 'owner@example.test',
      ALERT_EMAIL: {
        send: async () => {
          throw new Error('email routing unavailable')
        },
      },
    }
    await expect(runRelayWatch(env, START, bothUp)).rejects.toThrow(
      'email routing unavailable'
    )
    expect(db.row).toBeNull()
  })

  it('leaves the row alone without a mail binding, so the armed mail survives', async () => {
    const db = fakeDb(null)
    const result = await runRelayWatch({ DB: db }, START, bothUp)
    expect(result).toMatchObject({ notified: false, reason: 'no-mail-binding' })
    expect(db.row).toBeNull()
  })

  it('stays silent when the state cannot be read', async () => {
    const broken = {
      prepare: () => ({
        bind: () => ({
          first: async () => {
            throw new Error('D1_ERROR')
          },
        }),
      }),
    } as unknown as D1Database
    const sent: unknown[] = []
    const result = await runRelayWatch(
      { DB: broken, ALERT_EMAIL: { send: async (m) => void sent.push(m) } },
      START,
      bothUp
    )
    expect(result).toMatchObject({
      skipped: expect.stringContaining('D1_ERROR'),
    })
    expect(sent).toHaveLength(0)
  })

  it('pages when the primary is gone but the fallback carries', async () => {
    const db = fakeDb({ state: 'healthy', since: 0, notified_at: START - HOUR })
    const sent: { subject: string }[] = []
    const result = await runRelayWatch(
      {
        DB: db,
        ALERT_EMAIL_TO: 'owner@example.test',
        ALERT_EMAIL: {
          send: async (m) => void sent.push(m as { subject: string }),
        },
      },
      START,
      primaryDown
    )
    expect(result).toMatchObject({
      state: 'fallback-only',
      notified: true,
      reason: 'changed',
    })
    expect(sent[0].subject).toContain('primary')
    expect((sent[0] as unknown as { to: string }).to).toBe('owner@example.test')
    expect(db.row).toMatchObject({ state: 'fallback-only', since: START })
  })

  it('sends nothing and keeps the row without a recipient secret', async () => {
    const db = fakeDb(null)
    const sent: unknown[] = []
    const result = await runRelayWatch(
      { DB: db, ALERT_EMAIL: { send: async (m) => void sent.push(m) } },
      START,
      bothUp
    )
    expect(result).toMatchObject({ notified: false, reason: 'no-recipient' })
    expect(sent).toHaveLength(0)
    expect(db.row).toBeNull()
  })
})
