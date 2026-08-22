'use client'

/**
 * Client-side account state.
 *
 * The access token is held in memory only and never persisted: it lives 15
 * minutes, and the durable credential is the httpOnly session cookie the browser
 * sends on its own. Nothing here is trusted — every entitlement decision is made
 * server-side and merely reported to this module.
 *
 * Modelled as an external store rather than React state for the same reason
 * `use-local-storage.ts` is: a `useSyncExternalStore` snapshot avoids the
 * render → effect → setState cascade, and lets a page paint the right control on
 * its first frame instead of after a round trip.
 */
import { HINT_COOKIE } from '@/lib/auth/cookies'
import type { FilterPreset } from '@/lib/filter-presets'
import type { QuietHours } from '@/lib/push/quiet'

/** Refresh this far before expiry, so an action never races the deadline. */
const REFRESH_MARGIN_MS = 30_000

export interface PlanState {
  status: string | null
  variant: string | null
  renewsAt: number | null
  endsAt: number | null
  pastDueSince: number | null
  /** True when entitlement comes from a Buy Me a Coffee grant. */
  granted: boolean
}

export interface AccountPrefs {
  accent?: string
  density?: string
  autoNext?: boolean
  alerts?: boolean
  source?: string
  /** Hide the titles of episodes you have not ticked off yet. */
  spoilerFree?: boolean
  /**
   * Opted in to the supporters-only player trial (config/sources.ts
   * RICH_SOURCE). Honoured only while the account is entitled, so lapsed
   * supporters fall back to the standard servers with nothing to undo.
   */
  richPlayer?: boolean
  /**
   * Which country "now streaming" alerts are about. See config/regions.ts —
   * unset means the alert stays quiet rather than guessing a country wrong.
   */
  region?: string
  /** Saved browse filters. See lib/filter-presets.ts for why they live here. */
  presets?: FilterPreset[]
  /** Reely Player preferences. See lib/playback-prefs.ts. */
  playback?: {
    sub?: string
    subSize?: 's' | 'm' | 'l'
  }
  /**
   * Hours not to be buzzed in, and one buzz a day instead of one per event.
   *
   * Neither drops an alert: the notification row is written by the sweep either
   * way and is waiting when the app is next opened. See lib/push/quiet.ts.
   */
  quiet?: QuietHours
  digest?: boolean
}

export interface AccountState {
  /** Undefined until the first refresh settles. */
  signedIn: boolean | undefined
  /**
   * The last refresh could not be answered — offline, or a deployment with no
   * `DB` binding answering 503. Without this the account page waits on
   * `signedIn` forever behind a skeleton that never resolves. It never clears
   * account state: only an explicit 401 does that.
   */
  failed: boolean
  userId: string | null
  pro: boolean
  email: string | null
  name: string | null
  picture: string | null
  createdAt: number | null
  plan: PlanState | null
  prefs: AccountPrefs
}

/**
 * What the header needs in order to paint, and nothing else.
 *
 * Mirrored into localStorage so the avatar renders on the very first frame of
 * any page with no request: the hint cookie says WHETHER someone is signed in,
 * this says WHO. A page view still costs zero Worker invocations, which is the
 * constraint the whole design is built around.
 *
 * It is a cache of the visitor's own Google profile, not a credential. Anything
 * that could be forged into entitlement (the user id, the access token) stays
 * out on purpose.
 */
export interface CachedProfile {
  email: string | null
  name: string | null
  picture: string | null
  pro: boolean
  /**
   * Appearance, cached for the same reason the name is: the blocking script in
   * <head> sets the accent before the first paint, and it can only read what is
   * already on the device. See APPEARANCE_BOOT_SCRIPT.
   */
  accent: string | null
  density: string | null
  /**
   * How many saved filters this account has. Not the presets themselves — the
   * count is all the filter sidebar needs to reserve the right amount of room
   * before the session answers, and reserving it is what keeps the panel from
   * shifting under the cursor. See components/media/saved-filters.tsx.
   */
  presets: number
}

const PROFILE_CACHE_KEY = 'reely_profile'

/** Synchronous, never throws: Safari private mode makes localStorage a trap. */
export function cachedProfile(): CachedProfile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      email: typeof parsed.email === 'string' ? parsed.email : null,
      name: typeof parsed.name === 'string' ? parsed.name : null,
      picture: typeof parsed.picture === 'string' ? parsed.picture : null,
      pro: parsed.pro === true,
      accent: typeof parsed.accent === 'string' ? parsed.accent : null,
      density: typeof parsed.density === 'string' ? parsed.density : null,
      presets: typeof parsed.presets === 'number' ? parsed.presets : 0,
    }
  } catch {
    return null
  }
}

/** The cache is a projection of the store, written from one place only. */
function cacheFromState(next: AccountState): CachedProfile {
  return {
    email: next.email,
    name: next.name,
    picture: next.picture,
    pro: next.pro,
    accent: next.prefs.accent ?? null,
    density: next.prefs.density ?? null,
    presets: next.prefs.presets?.length ?? 0,
  }
}

function writeProfileCache(profile: CachedProfile | null): void {
  try {
    if (!profile) window.localStorage.removeItem(PROFILE_CACHE_KEY)
    else window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
  } catch {
    // Quota, private mode, or a blocked origin. The avatar waits for the next
    // refresh instead of painting immediately; nothing else depends on it.
  }
}

interface Token {
  token: string
  expiresAt: number
}

export function tokenIsUsable(token: Token | null, now: number): boolean {
  if (!token) return false
  return token.expiresAt - now > REFRESH_MARGIN_MS
}

export function signInHref(redirectTo?: string): string {
  if (!redirectTo) return '/api/auth/google'
  return `/api/auth/google?redirect_to=${encodeURIComponent(redirectTo)}`
}

/**
 * Whether the browser is probably signed in, answered synchronously with no
 * network call. The header renders from this, which is what keeps a page view at
 * zero Worker invocations — see lib/auth/cookies.ts.
 */
export function hasAccountHint(): boolean {
  try {
    return document.cookie
      .split(';')
      .some((part) => part.trim().startsWith(`${HINT_COOKIE}=1`))
  } catch {
    return false
  }
}

const BASE = {
  failed: false,
  userId: null,
  pro: false,
  email: null,
  name: null,
  picture: null,
  createdAt: null,
  plan: null,
  prefs: {},
} as const

const SIGNED_OUT: AccountState = Object.freeze({ ...BASE, signedIn: false })
const UNKNOWN: AccountState = Object.freeze({ ...BASE, signedIn: undefined })

let state: AccountState = UNKNOWN
let token: Token | null = null
let inFlight: Promise<void> | null = null

const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

export function subscribeAccount(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The store's reader. Exported so transitions can be tested without a renderer. */
export function accountSnapshot(): AccountState {
  return state
}

export const accountServerSnapshot = (): AccountState => UNKNOWN

/**
 * The one path to signed-out state, so the profile cache can never outlive the
 * session it describes.
 */
function settleSignedOut(): void {
  token = null
  writeProfileCache(null)
  if (state === SIGNED_OUT) return
  state = SIGNED_OUT
  notify()
}

function markFailed(): void {
  if (state.failed) return
  state = { ...state, failed: true }
  notify()
}

function parsePrefs(raw: unknown): AccountPrefs {
  if (typeof raw !== 'string' || !raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as AccountPrefs) : {}
  } catch {
    return {}
  }
}

/**
 * Lazy, never on a timer.
 *
 * A 15-minute heartbeat would be 96 requests per signed-in browser per day, and
 * this site's whole architecture exists to keep page views off the Worker.
 * Refreshing on demand ties cost to activity instead: a tab left open overnight
 * costs nothing.
 */
export async function refreshAccount(
  opts: { force?: boolean } = {}
): Promise<void> {
  if (!opts.force && tokenIsUsable(token, Date.now())) return
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST' })
      if (response.status === 401) {
        settleSignedOut()
        return
      }
      // Anything else — notably the 503 a deployment without `DB` returns — is
      // unanswerable, not signed out.
      if (!response.ok) {
        markFailed()
        return
      }

      const data = await response.json()
      if (!data?.success) {
        markFailed()
        return
      }

      token = { token: data.token, expiresAt: data.expiresAt }
      state = {
        signedIn: true,
        failed: false,
        userId: data.userId ?? null,
        pro: data.pro === true,
        email: data.email ?? null,
        name: data.name ?? null,
        picture: data.picture ?? null,
        createdAt: data.createdAt ?? null,
        plan: data.plan ?? null,
        prefs: parsePrefs(data.prefs),
      }
      writeProfileCache(cacheFromState(state))
      notify()
    } catch {
      // Network failure. Deliberately leaves the existing token and state in
      // place: a supporter must never be downgraded because one request failed.
      markFailed()
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

/** Save preferences, optimistically, and keep the profile cache in step. */
export async function savePrefs(next: AccountPrefs): Promise<boolean> {
  const merged = { ...state.prefs, ...next }
  state = { ...state, prefs: merged }
  notify()
  writeProfileCache(cacheFromState(state))

  try {
    const response = await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefs: merged }),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function deleteAccount(): Promise<{
  ok: boolean
  error?: string
}> {
  try {
    const response = await fetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete: true }),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.success !== true) {
      return {
        ok: false,
        error: data?.error ?? 'Could not delete the account.',
      }
    }
    settleSignedOut()
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not reach the server.' }
  }
}

export async function signOut(all = false): Promise<void> {
  try {
    await fetch(`/api/auth/logout${all ? '?all=1' : ''}`, { method: 'POST' })
  } catch {
    // The cookies are cleared server-side; a failure here means retrying.
  }
  settleSignedOut()
}

/** The in-memory access token, or null. */
export function currentAccessToken(): string | null {
  if (!token) return null
  if (token.expiresAt <= Date.now()) return null
  return token.token
}

/**
 * Settle the store as signed out without spending a request.
 *
 * The hint cookie is the client's own answer to "is there a session?", so a
 * visitor without one needs no round trip to learn they are signed out. That is
 * what keeps a page view at zero Worker requests.
 */
export function markSignedOut(): void {
  settleSignedOut()
}
