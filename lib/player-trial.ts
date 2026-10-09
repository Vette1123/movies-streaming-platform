// One free title a day on the Reely Player, for anybody who is not a supporter.
//
// The support page sells the house player in words, and words were losing:
// 1.6% of visitors ever clicked through to it, while the strongest single
// placement on the site was the stall notice - the moment a free server had
// just failed them. That is where the player gets to make its own case, so the
// offer there is to watch on it, not to read about it.
//
// Bounded per browser in localStorage. That is deliberate and it is the whole
// enforcement: /api/pro/ticket mints for anybody while PRO_PLAYER_OPEN is set
// (wrangler.jsonc), so a server-side counter would be guarding a door that is
// already open.
// ponytail: client-side limit only; when PRO_PLAYER_OPEN is removed, the ticket
// endpoint 402s non-supporters and the trial falls back to the default server
// (useStreamSource -> trial.end). Upgrade path: a `player_trials` row per user
// per day checked in handleProTicket before the entitlement 402.

export const TRIAL_KEY = 'reely_player_trial'

/** A day, so "free again tomorrow" is literally true. */
export const TRIAL_WINDOW_MS = 24 * 60 * 60 * 1000

export interface TrialRecord {
  /** Which title the trial was spent on (`movie:550`, `series:1399`). */
  key: string
  /** When it was started, epoch ms. */
  at: number
}

export type TrialStatus =
  /** Not spent today: offer it. */
  | 'available'
  /** Spent on THIS title today: keep playing it on the Reely Player. */
  | 'active'
  /** Spent on another title today. */
  | 'used'

/**
 * Where this browser stands for this title.
 *
 * The trial follows the TITLE for the whole day, so a reload, a second sitting
 * or the next episode of the same show stays on the player. Anything else in
 * that day is `used`; a day later it is offered again.
 */
export function trialStatus(
  record: TrialRecord | null,
  mediaKey: string,
  now: number
): TrialStatus {
  if (!record || !Number.isFinite(record.at)) return 'available'
  // A clock set backwards must not grant a second trial or lock one forever.
  const age = now - record.at
  if (age < 0 || age >= TRIAL_WINDOW_MS) return 'available'
  return record.key === mediaKey ? 'active' : 'used'
}

export function readTrial(): TrialRecord | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(TRIAL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TrialRecord>
    if (typeof parsed.key !== 'string' || typeof parsed.at !== 'number')
      return null
    return { key: parsed.key, at: parsed.at }
  } catch {
    return null
  }
}

export function writeTrial(record: TrialRecord): void {
  try {
    window.localStorage.setItem(TRIAL_KEY, JSON.stringify(record))
  } catch {
    // Storage denied: the trial still plays this once, it just is not
    // remembered - which errs toward the visitor, the right way to err.
  }
}
