import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { checkRelayHealth } from '@/lib/pro/relay-health'
import { reelyUpFrom } from '@/hooks/use-reely-up'

// 2026-11-13: the provider shut the relay out and every Reely play booted into
// a dead frame before falling back (~40% of the source's plays failed). These
// pin the three places that must agree it is down: the server's health answer,
// the ticket route, and the client's choice of source.

/** The exact /selftest answer of the 2026-11-13 outage. */
const NOV_13 = {
  provider: 'vidsrcme',
  ty: 'movie',
  id: 550,
  ok: false,
  error:
    'Error: /api.php -> 403 "{\\"status_code\\":\\"403\\",\\"error\\":\\"invalid api token\\"}" len=49 server=cloudflare',
  totalMs: 308,
}
const WALKED = {
  ok: true,
  master: { bytes: 900, isM3U: true },
  segment: { status: 200, bytes: 512000, ms: 300 },
}

const answering = (body: unknown, status = 200) =>
  (async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
    })) as unknown as typeof fetch

describe('checkRelayHealth', () => {
  it('reads the Nov 13 refusal as down, quoting it', async () => {
    const health = await checkRelayHealth(undefined, answering(NOV_13))
    expect(health.up).toBe(false)
    expect(health.reason).toContain('invalid api token')
  })

  it('reads a walk that reached a segment as up', async () => {
    expect(await checkRelayHealth(undefined, answering(WALKED))).toEqual({
      up: true,
    })
  })

  it('does not take the player away for a 90s rate-limit cooldown', async () => {
    const cooling = { ok: false, coolingFor: 80 }
    expect((await checkRelayHealth(undefined, answering(cooling))).up).toBe(
      true
    )
  })

  it('reads a dead deploy or an unreachable relay as down', async () => {
    const html = answering('<html>502 Bad Gateway</html>', 502)
    expect((await checkRelayHealth(undefined, html)).up).toBe(false)
    const unreachable = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    expect((await checkRelayHealth(undefined, unreachable)).up).toBe(false)
  })
})

describe('the client reading /api/stream/health', () => {
  it('is down only on an explicit up:false, so a hiccup never hides the player', () => {
    expect(reelyUpFrom({ up: false, reason: 'x' })).toBe(false)
    expect(reelyUpFrom({ up: true })).toBe(true)
    expect(reelyUpFrom(null)).toBe(true)
    expect(reelyUpFrom({})).toBe(true)
  })
})

async function sourcesWithPlayer() {
  vi.resetModules()
  const saved = { ...process.env }
  process.env.NEXT_PUBLIC_STREAMING_MOVIES_API_URL = 'https://a.example/embed'
  process.env.NEXT_PUBLIC_STREAM_SOURCE_2 = 'https://b.example/embed'
  process.env.NEXT_PUBLIC_PRO_TRIAL_SELFHOST = 'true'
  try {
    return await import('@/config/sources')
  } finally {
    process.env = saved
  }
}

describe('source choice while the player is down', () => {
  afterEach(() => vi.resetModules())

  it('never makes it a supporter default', async () => {
    const mod = await sourcesWithPlayer()
    const sources = mod.visibleSourcesFor(true, true)
    expect(mod.resolveSourceId({ sources, pro: true })).toBe(
      mod.REELY_SOURCE_ID
    )
    expect(mod.resolveSourceId({ sources, pro: true, reelyUp: false })).toBe(
      mod.DEFAULT_SOURCE_ID
    )
  })

  it('never restores it from per-title memory or the Settings choice', async () => {
    const mod = await sourcesWithPlayer()
    const sources = mod.visibleSourcesFor(true, true)
    const id = mod.resolveSourceId({
      sources,
      remembered: mod.REELY_SOURCE_ID,
      accountSource: mod.REELY_SOURCE_ID,
      pro: true,
      reelyUp: false,
    })
    expect(id).not.toBe(mod.REELY_SOURCE_ID)
    expect(id).toBe(mod.DEFAULT_SOURCE_ID)
  })

  it('keeps a remembered embed choice, which is still playable', async () => {
    const mod = await sourcesWithPlayer()
    const sources = mod.visibleSourcesFor(true, true)
    const embed = sources.find((s) => s.id !== mod.REELY_SOURCE_ID)!.id
    expect(
      mod.resolveSourceId({
        sources,
        remembered: embed,
        pro: true,
        reelyUp: false,
      })
    ).toBe(embed)
  })

  it('never hops onto it', async () => {
    const mod = await sourcesWithPlayer()
    const rescue = mod.playableSources(mod.rescueSourcesFor(true, true), false)
    expect(rescue.some((s) => s.id === mod.REELY_SOURCE_ID)).toBe(false)
    expect(rescue.length).toBe(mod.STREAM_SOURCES.length)
  })
})

describe('the Worker', () => {
  const worker = readFileSync('cloudflare/worker.js', 'utf8')
  const ticket = worker.slice(worker.indexOf('async function handleProTicket'))

  it('answers /api/stream/health from the shared check', () => {
    expect(worker).toContain("pathname === '/api/stream/health'")
    expect(worker).toContain('checkRelayHealth(')
  })

  it('refuses a ticket while the relay is down, BEFORE a free title is spent', () => {
    const guard = ticket.indexOf('relayHealthCached(')
    const spend = ticket.indexOf('ticketDenial(')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(spend)
  })
})

describe('the relay-down issue', () => {
  it('is opened once: an open issue is looked for before one is created', () => {
    const flow = readFileSync('.github/workflows/relay-canary.yml', 'utf8')
    const look = flow.indexOf('gh issue list --state open --label relay-down')
    const create = flow.indexOf('gh issue create')
    expect(look).toBeGreaterThan(-1)
    expect(look).toBeLessThan(create)
    expect(flow).toMatch(/if \[ -z "\$open" \]; then[\s\S]*gh issue create/)
  })
})
