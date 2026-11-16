/**
 * Who may have a playback ticket. The one check the Reely Player has, because
 * a signed ticket is all the private worker asks for.
 *
 *   - A supporter, by cookie or by a linked TV's bearer: always.
 *   - A linked TV that is not a supporter: never. The trial is a web offer.
 *   - Anyone else: one title in any 24 hours, by account, or by hashed address
 *     when signed out. The same title stays open all day, so a reload or the
 *     next episode does not read as a second title.
 *
 * lib/player-trial.ts is the browser's copy of the same rule, which decides what
 * to offer. This one decides what is allowed.
 */

import { loadSession } from '@/lib/auth/session'
import { isEntitled } from '@/lib/billing/entitlement'
import { TRIAL_WINDOW_MS } from '@/lib/player-trial'
import { sha256Hex } from '@/lib/token'

export interface TicketDenial {
  status: 401 | 402 | 503
  error: string
}

export interface TicketRequest {
  bearer: string | null
  cookie: string | null
  /** CF-Connecting-IP. Never stored: only its keyed hash is. */
  ip: string | null
  /** Keys the address hash. */
  secret: string | undefined
  /** `movie:550`, `tv:1399`. Episodes of a show are one title. */
  media: string
  now: number
}

const SUPPORTER_FEATURE: TicketDenial = {
  status: 402,
  error: 'The Reely Player is a supporter feature.',
}

/**
 * The supporter fast path, and the D1 outage shelter.
 *
 * Every boot used to pay a D1 read (the session JOIN) before it could mint,
 * which made the database a single point of failure for ALL player access: one
 * bad D1 minute and supporters could not play either. So the entitlement
 * decision a credential earned is remembered at the edge for five minutes:
 *
 *   - the fast path: an entitled credential mints with no D1 read at all;
 *   - the shelter: when D1 throws and the credential was entitled minutes
 *     ago, the cache answers and the boot goes on — anonymous trials still
 *     fail closed, because nothing about THEM is cached.
 *
 * Only a YES is ever cached, so a new supporter is never delayed and a refusal
 * is always a fresh decision. The cost of the window is bounded and honest: a
 * killed session (sign-out everywhere, password reset) keeps working for at
 * most five minutes, which is shorter than the 90-second ticket it mints
 * before, and only for whoever already held the cookie.
 */
const ENTITLEMENT_TTL_MS = 5 * 60 * 1000

interface CachedEntitlement {
  e: boolean
  /** Epoch ms the entry stops being trusted. */
  x: number
}

/**
 * The edge cache when there is one. `caches.default` is Cloudflare's Cache
 * API extension — the DOM lib's CacheStorage does not know it — so it is
 * reached through this shape; and in node (tests, builds) there is no Cache
 * API at all, where null is the whole point: the fast path must simply not
 * exist there, never decide anything, and never throw.
 */
interface EdgeCache {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}
const edgeCache = (): EdgeCache | null =>
  (globalThis as { caches?: { default?: EdgeCache } }).caches?.default ?? null

/** The credential never appears in the cache key: hashes only. */
const cacheKeyOf = async (credential: string): Promise<Request> =>
  new Request(
    `https://entitlement.reely.internal/${await sha256Hex(credential)}`
  )

const cachedSupporter = async (
  credential: string,
  now: number
): Promise<boolean> => {
  const cache = edgeCache()
  if (!cache) return false
  try {
    const hit = await cache.match(await cacheKeyOf(credential))
    if (!hit) return false
    const body = (await hit
      .json()
      .catch(() => null)) as CachedEntitlement | null
    return body?.e === true && typeof body.x === 'number' && body.x > now
  } catch {
    // Cache trouble must never decide anything.
    return false
  }
}

const rememberSupporter = async (
  credential: string,
  now: number
): Promise<void> => {
  const cache = edgeCache()
  if (!cache) return
  try {
    await cache.put(
      await cacheKeyOf(credential),
      new Response(
        JSON.stringify({
          e: true,
          x: now + ENTITLEMENT_TTL_MS,
        } as CachedEntitlement),
        {
          headers: { 'content-type': 'application/json' },
        }
      )
    )
  } catch {
    // Best effort only — the normal path still ran.
  }
}

/**
 * Take the subject's trial for this title, or find it already taken.
 *
 * The upsert only replaces an expired row, so two tabs racing for two titles
 * cannot both win: whichever row survives is the answer for both of them.
 */
async function holdsTrial(
  db: D1Database,
  subject: string,
  media: string,
  now: number
): Promise<boolean> {
  await db
    .prepare(
      `INSERT INTO player_trials (subject, media, expires_at) VALUES (?, ?, ?)
       ON CONFLICT(subject) DO UPDATE
       SET media = excluded.media, expires_at = excluded.expires_at
       WHERE player_trials.expires_at <= ?`
    )
    .bind(subject, media, now + TRIAL_WINDOW_MS, now)
    .run()
  const held = await db
    .prepare('SELECT media FROM player_trials WHERE subject = ?')
    .bind(subject)
    .first<{ media: string }>()
  return held?.media === media
}

async function trialSubject(
  userId: string | undefined,
  { ip, secret }: TicketRequest
): Promise<string | null> {
  if (userId) return `user:${userId}`
  if (!ip || !secret) return null
  return `ip:${await sha256Hex(`${secret}:${ip}`)}`
}

/** Why this request gets no ticket, or null when it gets one. */
export async function ticketDenial(
  db: D1Database | undefined,
  request: TicketRequest
): Promise<TicketDenial | null> {
  if (!db) return { status: 503, error: 'Playback not configured' }

  const { bearer, cookie, media, now } = request
  const credential = bearer ?? cookie
  // Fast path AND D1 shelter, in one: a credential the edge saw entitled
  // minutes ago mints with no D1 read at all, so a database blip cannot take
  // the player down with it. Anonymous trials are never cached, so they still
  // fail closed exactly as before.
  if (credential && (await cachedSupporter(credential, now))) return null
  const user = await loadSession(db, credential, now)
  if (user && isEntitled(user, now)) {
    // Seed the fast path — awaited, so the put is done before the ticket is
    // handed out and the next boot needs no D1 read.
    if (credential) await rememberSupporter(credential, now)
    return null
  }
  if (bearer) {
    return user ? SUPPORTER_FEATURE : { status: 401, error: 'Not signed in' }
  }

  const subject = await trialSubject(user?.id, request)
  if (!subject) return SUPPORTER_FEATURE
  return (await holdsTrial(db, subject, media, now)) ? null : SUPPORTER_FEATURE
}

/**
 * Hand today's free title back when the provider turned out not to carry it.
 *
 * The trial is taken at mint, before anybody knows whether a stream exists, so
 * a title the provider lacks used to spend the visitor's one title on a black
 * frame. The browser asks for the refund, but it decides nothing:
 *
 *   - only the subject holding THIS title's live trial can release it, the same
 *     subject the mint computed (account, else keyed address);
 *   - `providerHasNoStream` must say so, and it asks the player worker, which
 *     asks the relay's own resolve. Anything but a definite "no" keeps it spent.
 *
 * The probe runs last, after the cheap D1 checks, so a refund request from
 * somebody without a trial never reaches the provider.
 */
export async function releaseTrial(
  db: D1Database | undefined,
  request: TicketRequest,
  providerHasNoStream: () => Promise<boolean>
): Promise<boolean> {
  if (!db) return false
  const { bearer, cookie, media, now } = request
  // A TV never holds a trial, and a supporter never spent one.
  if (bearer) return false
  const user = await loadSession(db, cookie, now)
  if (user && isEntitled(user, now)) return false

  const subject = await trialSubject(user?.id, request)
  if (!subject) return false
  const held = await db
    .prepare('SELECT media, expires_at FROM player_trials WHERE subject = ?')
    .bind(subject)
    .first<{ media: string; expires_at: number }>()
  if (!held || held.media !== media || held.expires_at <= now) return false

  if (!(await providerHasNoStream())) return false
  const result = await db
    .prepare('DELETE FROM player_trials WHERE subject = ? AND media = ?')
    .bind(subject, media)
    .run()
  return Number(result.meta?.changes ?? 0) > 0
}

/** Spent trials, from the hourly cron. */
export async function sweepPlayerTrials(
  db: D1Database,
  now: number
): Promise<void> {
  await db
    .prepare('DELETE FROM player_trials WHERE expires_at <= ?')
    .bind(now)
    .run()
}
