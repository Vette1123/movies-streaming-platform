// Context every event carries, and the once-ever milestones derived from it.
//
// Ported from masareef and rafiq, because both answer questions this project
// could not: WHICH screen an autocaptured click or a rageclick came from
// (`route`, not 2,000 distinct `/tv-shows/<id>` pathnames), how far into
// somebody's life with the site an event happened (`visit_n`,
// `days_since_first_visit`), and how long a brand-new visitor took to reach the
// thing the site exists for (`first_play`, `since_first_visit_s`).
//
// Everything decision-shaped is a pure function so
// tests/analytics-context.test.ts can pin it; the storage glue at the bottom is
// the only part that touches the browser.

// ---- Route template ---------------------------------------------------------

// Segments whose NEXT segment is an id even when it is not numeric: a public
// profile handle and a shared list's id.
const ID_PARENTS = new Set(['u', 'l'])

/**
 * `/tv-shows/72071` → `/tv-shows/:id`, `/movies/year/2019` → `/movies/year/:year`,
 * `/u/sam` → `/u/:id`. Genre slugs are kept: there are ~20 and they are the
 * breakdown worth having.
 */
export function routeTemplate(pathname: string): string {
  const parts = pathname.split('?')[0].split('/').filter(Boolean)
  const out = parts.map((segment, i) => {
    const parent = parts[i - 1]
    if (i === 1 && ID_PARENTS.has(parent)) return ':id'
    if (!/^\d+(-.*)?$/.test(segment)) return segment
    return parent === 'year' ? ':year' : ':id'
  })
  return `/${out.join('/')}`
}

// ---- Visits -----------------------------------------------------------------

/** Inactivity that ends a visit — PostHog's own session timeout. */
export const VISIT_GAP_MS = 30 * 60 * 1000

export interface VisitRecord {
  first_at: number
  last_at: number
  visit_n: number
  /**
   * The browser was already using the site before this record existed (the
   * deploy that shipped it), so `first_at` is when counting began, not when the
   * visitor arrived. Milestones never fire for a seeded browser: its "first
   * play" happened long ago and would be counted as activation.
   */
  seeded: boolean
}

/**
 * Advance the record for activity at `now`. A new browser starts at visit 1;
 * a gap longer than VISIT_GAP_MS starts the next visit.
 */
export function nextVisit(
  prev: VisitRecord | null,
  now: number,
  seenBefore: boolean
): { record: VisitRecord; newVisit: boolean } {
  if (!prev) {
    return {
      record: { first_at: now, last_at: now, visit_n: 1, seeded: seenBefore },
      newVisit: true,
    }
  }
  const newVisit = now - prev.last_at > VISIT_GAP_MS
  return {
    record: {
      ...prev,
      last_at: now,
      visit_n: newVisit ? prev.visit_n + 1 : prev.visit_n,
    },
    newVisit,
  }
}

/** Super properties derived from the record — carried on every event. */
export function visitTraits(record: VisitRecord, now: number) {
  return {
    visit_n: record.visit_n,
    days_since_first_visit: Math.floor((now - record.first_at) / 86_400_000),
    returning_visitor: record.visit_n > 1 || record.seeded,
  }
}

// ---- Milestones -------------------------------------------------------------

/** The core actions, by the event that proves each one happened. */
export const CORE_FEATURE: Record<string, string> = {
  media_played: 'play',
  search_performed: 'search',
  watchlist_added: 'watchlist',
  trailer_played: 'trailer',
}

export interface Milestone {
  /** Latch key — fires once per browser, ever. */
  key: 'first_play' | 'first_core_use'
  properties: Record<string, unknown>
}

/**
 * Which once-ever events `event` earns, given which latches are already set.
 * Derived in the one choke point every event passes (lib/analytics `track`),
 * so no call site can forget to send them — masareef's `first_transaction`,
 * rafiq's `first_core_use`.
 */
export function milestonesFor(
  event: string,
  record: VisitRecord,
  now: number,
  claimed: (key: string) => boolean
): Milestone[] {
  const feature = CORE_FEATURE[event]
  if (!feature || record.seeded) return []
  const base = {
    since_first_visit_s: Math.round((now - record.first_at) / 1000),
    visit_n: record.visit_n,
  }
  const out: Milestone[] = []
  if (!claimed('first_core_use')) {
    out.push({ key: 'first_core_use', properties: { ...base, feature } })
  }
  if (feature === 'play' && !claimed('first_play')) {
    out.push({ key: 'first_play', properties: base })
  }
  return out
}

// ---- Storage glue -----------------------------------------------------------

const VISIT_KEY = 'reely:visit'
const ONCE_PREFIX = 'reely:once:'

// Evidence this browser used the site before the visit record existed: its
// watch history, its last-seen account state (lib/checkout.ts), or posthog-js's
// own persistence.
function seenBefore(): boolean {
  try {
    const history = window.localStorage.getItem('watchedItems')
    if (history && history !== '[]') return true
    if (window.localStorage.getItem('reely_last_account')) return true
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (key?.startsWith('ph_') && key.endsWith('_posthog')) return true
    }
  } catch {
    // Storage blocked: treat as new, which only risks one extra milestone.
  }
  return false
}

function readVisit(): VisitRecord | null {
  try {
    const raw = window.localStorage.getItem(VISIT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<VisitRecord>
    if (typeof parsed.first_at !== 'number') return null
    return {
      first_at: parsed.first_at,
      last_at: Number(parsed.last_at) || parsed.first_at,
      visit_n: Number(parsed.visit_n) || 1,
      seeded: parsed.seeded === true,
    }
  } catch {
    return null
  }
}

/** Record activity now; returns the current record and whether a visit began. */
export function noteActivity(now = Date.now()): {
  record: VisitRecord
  newVisit: boolean
} {
  const prev = readVisit()
  const next = nextVisit(prev, now, prev ? prev.seeded : seenBefore())
  try {
    window.localStorage.setItem(VISIT_KEY, JSON.stringify(next.record))
  } catch {
    // Without storage every load is visit 1; events still send.
  }
  return next
}

export function isClaimed(key: string): boolean {
  try {
    return window.localStorage.getItem(ONCE_PREFIX + key) !== null
  } catch {
    // Blocked storage cannot latch, so claim it rather than fire on every event.
    return true
  }
}

export function claim(key: string, now = Date.now()): void {
  try {
    window.localStorage.setItem(ONCE_PREFIX + key, String(now))
  } catch {
    // isClaimed already answers true for this browser.
  }
}
