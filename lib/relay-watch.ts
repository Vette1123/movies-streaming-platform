/**
 * The relay chain, watched from the one place that outlives both homes.
 *
 * The player already survives a dead relay (it walks both homes on every
 * resolve). What nothing survived was *silence*: if the Netlify primary
 * paused, or the Oracle VM behind relay-b was reclaimed, or its tunnel
 * stopped, the first
 * signal was a visitor pressing play. The hourly canary cannot close that
 * hole because GitHub's scheduler drifts by hours, and `relay-front-verify`
 * only runs when somebody remembers it.
 *
 * So the site's own Worker - the one thing that is up whenever a visitor can
 * reach Reely at all - checks each home every five minutes. It asks `/health`,
 * not `/selftest`: the question here is "is the home there", not "can it reach
 * the provider". `/health` costs no vault request, no provider walk, and no
 * egress, so a five-minute cadence is free. The provider's own health stays
 * with the canary and `/api/stream/health`, where a walk belongs.
 *
 * Mail is the alert channel: Cloudflare Email Routing is already on the zone,
 * so the Worker sends through `send_email`. Email Routing only delivers a
 * Worker's mail to a VERIFIED destination address, and a routed alias like
 * support@ is not one - so the recipient is the owner's verified inbox, held
 * in the `ALERT_EMAIL_TO` Worker secret (this repo is public; the address
 * never appears in it). No account, no token, no third party to also go down.
 *
 * The state machine is deliberately boring and deliberately pure
 * (`classify`, `decide`, `composeMessage`), because a watchdog with a bug that
 * pages every five minutes gets muted, and a muted watchdog is worse than
 * none. Tests: tests/relay-watch.test.ts.
 */

import { RELAY_2_URL, RELAY_URL } from '@/scripts/lib/relay-selftest.mjs'

/**
 * Which homes answered. Two booleans make four states, and the two mixed ones
 * are not equal. The primary is relay 1 (relay.reely.space, Netlify): the
 * player asks it first. The fallback is relay-b (relay-b.reely.space, the
 * Oracle VM behind the `reely-oracle-b` tunnel). Losing the fallback is not
 * an outage yet - but it is exactly the rot nobody would notice until the day
 * the primary dies, so it is mailed too, just less often.
 */
export type ChainState = 'healthy' | 'primary-only' | 'fallback-only' | 'down'

export interface Probe {
  up: boolean
  /** One line: the status, or why it could not be reached. */
  detail: string
}

export interface WatchState {
  state: ChainState
  /** When this state began, epoch ms. */
  since: number
  /** The last mail about it, epoch ms. */
  notifiedAt: number
}

export type NotifyReason = 'armed' | 'changed' | 'repeat'

export type Decision =
  | { notify: true; reason: NotifyReason; next: WatchState }
  | { notify: false; next: WatchState }

/** The row this watcher owns in `ops_health`. */
export const WATCH_NAME = 'relay-chain'

/**
 * How long a broken state waits before it is mailed again. A total outage is
 * re-sent every half hour (it is the one that means no film plays anywhere);
 * a missing fallback once a day, because it costs nothing until it is needed.
 * `healthy` is infinite: a healthy chain is never re-announced.
 */
export const RE_ALERT_MS: Record<ChainState, number> = {
  healthy: Number.POSITIVE_INFINITY,
  'primary-only': 24 * 60 * 60 * 1000,
  'fallback-only': 6 * 60 * 60 * 1000,
  down: 30 * 60 * 1000,
}

/** How long one `/health` may take. It answers `ok` in ~0.3s when alive. */
export const PROBE_TIMEOUT_MS = 8000

/** The sender: any address on the zone that has Email Routing on. */
export const ALERT_FROM = 'alerts@reely.space'

const isChainState = (value: unknown): value is ChainState =>
  value === 'healthy' ||
  value === 'primary-only' ||
  value === 'fallback-only' ||
  value === 'down'

/** Both booleans to one state. */
export const classify = (primary: Probe, fallback: Probe): ChainState => {
  if (primary.up) return fallback.up ? 'healthy' : 'primary-only'
  return fallback.up ? 'fallback-only' : 'down'
}

/**
 * What to do about the answer. Notify on the first sight (so the channel
 * proves itself once per deployment of this table), on every state change
 * (including recovery), and on the slow repeat while broken. Nothing else -
 * the healthy case must be able to run for years without a mail or a write.
 */
export function decide(
  prev: WatchState | null,
  state: ChainState,
  now: number
): Decision {
  if (!prev) {
    return {
      notify: true,
      reason: 'armed',
      next: { state, since: now, notifiedAt: now },
    }
  }
  if (prev.state !== state) {
    return {
      notify: true,
      reason: 'changed',
      next: { state, since: now, notifiedAt: now },
    }
  }
  if (state !== 'healthy' && now - prev.notifiedAt >= RE_ALERT_MS[state]) {
    return {
      notify: true,
      reason: 'repeat',
      next: { ...prev, notifiedAt: now },
    }
  }
  return { notify: false, next: prev }
}

/** One home's `/health`. Never throws: an unreachable home is a down home. */
export async function probeHome(
  root: string,
  fetcher: typeof fetch = fetch,
  timeoutMs: number = PROBE_TIMEOUT_MS
): Promise<Probe> {
  const url = `${root.replace(/\/+$/, '')}/health`
  try {
    const res = await fetcher(url, {
      headers: { 'user-agent': 'reely-relay-watch/1.0' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    const text = (await res.text()).trim()
    if (res.ok && text === 'ok') return { up: true, detail: `${res.status} ok` }
    return {
      up: false,
      detail: `HTTP ${res.status}: ${text.slice(0, 80) || '(empty)'}`,
    }
  } catch (error) {
    return { up: false, detail: String(error).slice(0, 120) }
  }
}

const SUBJECTS: Record<ChainState, string> = {
  healthy: '[Reely] relay chain healthy again',
  'primary-only': '[Reely] relay fallback is DOWN (primary carrying)',
  'fallback-only': '[Reely] relay primary is DOWN (fallback carrying)',
  down: '[Reely] relay chain is DOWN - no home answering',
}

const REMEDY: Record<ChainState, string[]> = {
  healthy: ['Nothing to do.'],
  'primary-only': [
    'The player is fine - relay 1 (Netlify) is carrying every play. But',
    'relay-b, the Oracle VM, is the insurance and it is not answering.',
    'Check the VM: sudo systemctl status reely-relay cloudflared',
    'Then: sudo systemctl restart reely-relay  (or restart cloudflared)',
    'Tunnel: dash.cloudflare.com > Networking > Tunnels > reely-oracle-b',
    'Runbook: reely-resolver-relay/deploy/README.md',
  ],
  'fallback-only': [
    'Plays still work - relay-b (the Oracle VM) is carrying them - but',
    'relay 1 on Netlify is not answering: usually a paused credit wallet.',
    'Check the Netlify team, then: cd reely-resolver-relay && npm run deploy',
    '(that ship spends ~15 Netlify deploy credits; re-probe with',
    'node scripts/relay-front-verify.mjs)',
  ],
  down: [
    'No film plays through the player right now. Check, in this order:',
    '1. the VM:  sudo systemctl status reely-relay cloudflared',
    '2. the tunnel: dash.cloudflare.com > Networking > Tunnels',
    '3. relay 1 on Netlify: cd reely-resolver-relay && npm run deploy',
    'Both homes being down at once is almost always DNS, Cloudflare, or the',
    'Netlify wallet - not the relay code.',
  ],
}

/** Why this mail is going out, in one line. */
function becauseLine(
  reason: NotifyReason,
  state: ChainState,
  previous: ChainState | null,
  sinceIso: string
): string {
  if (reason === 'armed') return 'First check of this watcher (armed).'
  if (reason === 'repeat')
    return `Still ${state} since ${sinceIso}; this is the periodic reminder.`
  return `Changed from ${previous ?? 'unknown'} to ${state}.`
}

/**
 * The mail. Plain text, no HTML, no links to click: it has to be readable in a
 * notification preview and pasteable into a terminal.
 */
export function composeMessage(input: {
  state: ChainState
  previous: ChainState | null
  reason: NotifyReason
  since: number
  now: number
  primary: Probe
  fallback: Probe
}): { subject: string; text: string } {
  const { state, previous, reason, since, now, primary, fallback } = input
  const when = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z')
  const homes = [
    `  primary  ${RELAY_URL} (Netlify)    -> ${primary.detail}`,
    `  fallback ${RELAY_2_URL} (Oracle VM) -> ${fallback.detail}`,
  ]
  const because = becauseLine(reason, state, previous, when(since))
  return {
    subject: SUBJECTS[state],
    text: [
      because,
      '',
      `state:    ${state}`,
      `since:    ${when(since)}`,
      `checked:  ${when(now)} from the site's 5-minute cron`,
      '',
      ...homes,
      '',
      ...REMEDY[state],
      '',
      '-- ',
      'Sent by lib/relay-watch.ts. The provider walk itself is the hourly',
      'canary (scripts/relay-canary.mjs) and /api/stream/health, not this.',
    ].join('\n'),
  }
}

/** The `send_email` binding, narrowed to the one call this file makes. */
export interface MailBinding {
  send(message: {
    from: string
    to: string
    subject: string
    text: string
  }): Promise<unknown>
}

export interface RelayWatchEnv {
  DB?: D1Database
  ALERT_EMAIL?: MailBinding
  /** The verified Email Routing destination (Worker secret). */
  ALERT_EMAIL_TO?: string
}

/** The stored state, or null when there is none (or it is unreadable). */
async function readState(db: D1Database): Promise<WatchState | null> {
  const row = await db
    .prepare('SELECT state, since, notified_at FROM ops_health WHERE name = ?')
    .bind(WATCH_NAME)
    .first<{ state: string; since: number; notified_at: number }>()
  if (!row || !isChainState(row.state)) return null
  return { state: row.state, since: row.since, notifiedAt: row.notified_at }
}

async function writeState(db: D1Database, next: WatchState): Promise<void> {
  await db
    .prepare(
      'INSERT INTO ops_health (name, state, since, notified_at) VALUES (?, ?, ?, ?) ' +
        'ON CONFLICT(name) DO UPDATE SET state = excluded.state, ' +
        'since = excluded.since, notified_at = excluded.notified_at'
    )
    .bind(WATCH_NAME, next.state, next.since, next.notifiedAt)
    .run()
}

export interface WatchResult {
  state: ChainState
  primary: Probe
  fallback: Probe
  notified: boolean
  reason?: NotifyReason | 'no-mail-binding' | 'no-recipient'
}

/**
 * One tick. Probes both homes in parallel, mails on a change, and advances the
 * stored row ONLY after the mail was handed to the binding - a failed send
 * must be retried on the next tick, not swallowed for half an hour.
 *
 * A database failure returns without mailing: without the row this could not
 * tell "already told them" from "first time", and an unreadable state must
 * never page every five minutes.
 */
export async function runRelayWatch(
  env: RelayWatchEnv,
  now: number = Date.now(),
  fetcher: typeof fetch = fetch
): Promise<WatchResult | { skipped: string }> {
  const db = env.DB
  if (!db) return { skipped: 'no db binding' }

  const [primary, fallback] = await Promise.all([
    probeHome(RELAY_URL, fetcher),
    probeHome(RELAY_2_URL, fetcher),
  ])
  const state = classify(primary, fallback)

  let prev: WatchState | null
  try {
    prev = await readState(db)
  } catch (error) {
    return { skipped: `state unreadable: ${String(error).slice(0, 120)}` }
  }

  const decision = decide(prev, state, now)
  if (!decision.notify) {
    return { state, primary, fallback, notified: false }
  }

  const message = composeMessage({
    state,
    previous: prev?.state ?? null,
    reason: decision.reason,
    since: decision.next.since,
    now,
    primary,
    fallback,
  })
  if (!env.ALERT_EMAIL) {
    // Local/dev: prove the decision without pretending a mail went out, and
    // leave the row alone so the first deployed tick still says "armed".
    return {
      state,
      primary,
      fallback,
      notified: false,
      reason: 'no-mail-binding',
    }
  }
  const to = env.ALERT_EMAIL_TO?.trim()
  if (!to) {
    // Same rule: no recipient secret means no mail and no row, so the first
    // tick after the secret lands still arms and proves the channel.
    return { state, primary, fallback, notified: false, reason: 'no-recipient' }
  }
  await env.ALERT_EMAIL.send({
    from: ALERT_FROM,
    to,
    ...message,
  })
  await writeState(db, decision.next)
  return {
    state,
    primary,
    fallback,
    notified: true,
    reason: decision.reason,
  }
}
