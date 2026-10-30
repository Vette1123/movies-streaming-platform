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
  const user = await loadSession(db, bearer ?? cookie, now)
  if (user && isEntitled(user, now)) return null
  if (bearer) {
    return user ? SUPPORTER_FEATURE : { status: 401, error: 'Not signed in' }
  }

  const subject = await trialSubject(user?.id, request)
  if (!subject) return SUPPORTER_FEATURE
  return (await holdsTrial(db, subject, media, now)) ? null : SUPPORTER_FEATURE
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
