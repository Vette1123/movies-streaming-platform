/**
 * The auth surface: five handlers, dispatched by cloudflare/worker.js.
 *
 * Every one of them is reached only by a request to `/api/auth/*` or
 * `/api/account`, so nothing here runs on a page view, on an existing `/api/*`
 * route, or on the tail-id fallback path — which between them are ~100% of this
 * Worker's traffic today.
 */

import { ALERT_REGION_IDS } from '@/config/regions'
import { claimSupporterGrants } from '@/lib/billing/bmc'
import { isEntitled, isProAt } from '@/lib/billing/entitlement'
import { REFERRALS_PER_MONTH } from '@/lib/billing/gifts'
import { grantMonths } from '@/lib/billing/months'
import { normalisePresets } from '@/lib/filter-presets'
import { normaliseHandle } from '@/lib/profile/routes'
import { normaliseQuietHours } from '@/lib/push/quiet'
import { ACCESS_TOKEN_TTL_MS, signToken } from '@/lib/token'

import { REFERRAL_COOKIE } from './cookies'
import {
  createAuthorizationUrl,
  decodeIdToken,
  exchangeAuthorizationCode,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  oauthTempCookie,
  randomToken,
  safeRedirect,
} from './google'
import {
  clearCookieHeaders,
  createSession,
  deleteAllSessions,
  deleteSession,
  loadSession,
  SESSION_TTL_MS,
  sessionCookieHeaders,
  sessionCookieOf,
} from './session'

function redirect(location: string, cookies: string[]): Response {
  const headers = new Headers({ Location: location })
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(null, { status: 302, headers })
}

/**
 * Whether a human is looking at this response.
 *
 * Both browser-facing auth endpoints are reached by following a redirect, so
 * their failures are rendered by a browser — and a browser renders
 * `{"error":"..."}` as exactly that, on a blank page, with no way back.
 */
function isNavigation(request: Request): boolean {
  if (request.headers.get('Sec-Fetch-Mode') === 'navigate') return true
  return (request.headers.get('Accept') ?? '').includes('text/html')
}

/**
 * Hand a failed sign-in back to the account page, which renders the reason above
 * a working "Continue with Google" button. The expired cookies go with it so a
 * retry starts from a clean slate rather than re-failing on the same stale
 * state.
 */
function authFailure(
  request: Request,
  origin: string,
  reason: 'expired' | 'failed' | 'email',
  error: string
): Response {
  const cookies = [
    oauthTempCookie(OAUTH_STATE_COOKIE, '', origin),
    oauthTempCookie(OAUTH_VERIFIER_COOKIE, '', origin),
  ]
  if (!isNavigation(request)) {
    const headers = new Headers({ 'Content-Type': 'application/json' })
    for (const cookie of cookies) headers.append('Set-Cookie', cookie)
    return new Response(JSON.stringify({ success: false, error }), {
      status: 400,
      headers,
    })
  }
  return redirect(`${origin}/account?signin=${reason}`, cookies)
}

/**
 * The state cookie packs two fields into one value, so the separator has to be a
 * character `encodeURIComponent` escapes and a base64url state can never
 * contain. `.` is neither, which in the sibling project silently truncated a
 * `.html` target.
 */
const STATE_SEPARATOR = '|'

export function packAuthState(state: string, target: string): string {
  return `${state}${STATE_SEPARATOR}${encodeURIComponent(target)}`
}

/**
 * The inverse. Never throws: a malformed percent-sequence in a cookie must fail
 * to the safe default, not 500 the callback. The returned target is still
 * untrusted — `safeRedirect` is what makes it safe to follow.
 */
export function unpackAuthState(cookie: string | null): {
  state: string
  target: string
} {
  const [state = '', encodedTarget = ''] = (cookie ?? '').split(STATE_SEPARATOR)
  try {
    return { state, target: decodeURIComponent(encodedTarget) || '/' }
  } catch {
    return { state, target: '/' }
  }
}

/**
 * Google sends `email_verified` as a boolean, and older tokens as a string. Only
 * an explicit negative rejects: an absent claim is not evidence of anything, and
 * `users.email` is what billing matches on.
 */
function emailUnverified(value: unknown): boolean {
  return value === false || value === 'false'
}

interface IdTokenClaims {
  sub?: string
  email?: string
  email_verified?: unknown
  name?: unknown
  picture?: unknown
}

/**
 * A profile claim, bounded. Google is the only writer and is not hostile, but
 * these two strings are the one part of the ID token that goes into the database
 * unvalidated and comes back out into a page — so they are length-capped at the
 * boundary rather than trusted to be sane.
 */
function claimText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

const json = (body: unknown, status = 200, cookies: string[] = []) => {
  const headers = new Headers({
    'Content-Type': 'application/json',
    // Never shared, never stored: these responses are per-session by definition.
    'Cache-Control': 'private, no-store',
  })
  for (const cookie of cookies) headers.append('Set-Cookie', cookie)
  return new Response(JSON.stringify(body), { status, headers })
}

/** GET /api/auth/google */
export async function handleAuthStart(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  if (!clientId) {
    return json(
      {
        success: false,
        error: 'Sign-in is not configured on this deployment.',
      },
      503
    )
  }

  const state = randomToken()
  const verifier = randomToken()
  const authorizationUrl = await createAuthorizationUrl(
    url.origin,
    state,
    verifier
  )

  // The post-login destination rides in the state cookie's sibling rather than
  // through Google, so it cannot be tampered with in transit.
  const target = safeRedirect(url.searchParams.get('redirect_to'), url.origin)

  return redirect(authorizationUrl, [
    oauthTempCookie(
      OAUTH_STATE_COOKIE,
      packAuthState(state, target),
      url.origin
    ),
    oauthTempCookie(OAUTH_VERIFIER_COOKIE, verifier, url.origin),
  ])
}

/**
 * Whether this callback is a SECOND delivery of one that already worked.
 *
 * An OAuth authorization code is single-use, and a callback URL can legitimately
 * be delivered twice — an installed PWA capturing an in-scope link, a browser
 * prefetching a redirect. One delivery redeems the code and the other gets
 * `invalid_grant`. The loser of that race must not render "sign-in failed" at
 * somebody who is, at that exact moment, signed in by the winner.
 *
 * This grants nothing: no session is created here, and the caller must already
 * hold a valid session cookie to reach the quiet path at all.
 */
async function sessionAlreadyLive(
  db: D1Database,
  request: Request,
  now: number
): Promise<boolean> {
  return (await loadSession(db, sessionCookieOf(request), now)) !== null
}

/** GET /api/auth/callback */
export async function handleAuthCallback(
  request: Request,
  db: D1Database
): Promise<Response> {
  const url = new URL(request.url)
  const origin = url.origin
  const cookies = request.headers.get('Cookie')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const storedState = readState(cookies)
  const verifier = readVerifier(cookies)

  const now = Date.now()
  const { state: expectedState, target: requestedTarget } =
    unpackAuthState(storedState)

  /**
   * The quiet ending for a duplicate callback: send them where the sign-in was
   * headed and expire the one-shot cookies, exactly as the successful branch
   * does. No notice — nothing went wrong.
   */
  const settled = async (): Promise<Response | null> => {
    if (!(await sessionAlreadyLive(db, request, now))) return null
    return redirect(`${origin}${safeRedirect(requestedTarget, origin)}`, [
      oauthTempCookie(OAUTH_STATE_COOKIE, '', origin),
      oauthTempCookie(OAUTH_VERIFIER_COOKIE, '', origin),
    ])
  }

  if (
    !code ||
    !state ||
    !verifier ||
    !expectedState ||
    state !== expectedState
  ) {
    const done = await settled()
    if (done) return done
    // Nearly always a lost cookie rather than an attack: the sign-in started in
    // a different browser (an in-app webview handing off), or the round trip
    // through consent and 2FA outlived the temporary cookie. Both are a retry.
    return authFailure(
      request,
      origin,
      'expired',
      'Sign-in could not be completed. Please try again.'
    )
  }

  let claims: IdTokenClaims
  try {
    const idToken = await exchangeAuthorizationCode(origin, code, verifier)
    claims = decodeIdToken(idToken) as IdTokenClaims
  } catch {
    const done = await settled()
    if (done) return done
    return authFailure(
      request,
      origin,
      'failed',
      'Sign-in could not be completed. Please try again.'
    )
  }

  if (!claims.sub || !claims.email) {
    return authFailure(
      request,
      origin,
      'email',
      'Google did not return an email address.'
    )
  }

  // An unverified address must never reach `users.email`: that column is what an
  // orphaned purchase is matched against, so accepting one would let anyone
  // claim someone else's supporter row by signing up with their address.
  if (emailUnverified(claims.email_verified)) {
    return authFailure(
      request,
      origin,
      'email',
      'Google did not return a verified email address.'
    )
  }

  // Google's `sub` identifies a person within ONE Google Cloud project, not
  // globally: point the deployment at a different OAuth client and every
  // returning visitor arrives with an unfamiliar `sub`, so the INSERT below
  // would open a second row and strand the first — its grants, its library, its
  // lists — behind an identifier nobody will present again. `users.email` is
  // only indexed, not unique, so nothing would have complained.
  //
  // Re-keying by address is safe precisely here, and only here: the address was
  // checked as verified four lines up.
  await db
    .prepare(
      'UPDATE users SET google_sub = ? WHERE email = ? AND google_sub != ?'
    )
    .bind(claims.sub, claims.email, claims.sub)
    .run()

  // ON CONFLICT keeps the email, name and avatar current for someone who changed
  // them at Google, without disturbing their billing columns. COALESCE on the
  // profile fields so a token that omits them leaves what we already have rather
  // than blanking the avatar.
  await db
    .prepare(
      `INSERT INTO users (id, google_sub, email, name, picture, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(google_sub) DO UPDATE SET
         email = excluded.email,
         name = COALESCE(excluded.name, users.name),
         picture = COALESCE(excluded.picture, users.picture)`
    )
    .bind(
      crypto.randomUUID(),
      claims.sub,
      claims.email,
      claimText(claims.name, 128),
      claimText(claims.picture, 512),
      now
    )
    .run()

  const user = await db
    .prepare(
      'SELECT id, created_at, referred_by FROM users WHERE google_sub = ?'
    )
    .bind(claims.sub)
    .first<{ id: string; created_at: number; referred_by: string | null }>()

  if (!user) {
    return json(
      { success: false, error: 'Could not create your account. Try again.' },
      500
    )
  }

  // Support usually arrives before the account does — nothing asks anyone to
  // sign in before paying — so the webhook can only record the grant against an
  // email address. This is where it becomes an entitlement. Run on every
  // sign-in, not only on creation: someone who supports months later gets it on
  // their next visit with no hand-run UPDATE. A failure here must not cost
  // anyone their session.
  try {
    await claimSupporterGrants(db, user.id, claims.email)
  } catch (error) {
    console.error('auth: could not claim supporter grants', String(error))
  }

  // Only on the sign-in that created the account: `created_at` is stamped by
  // the INSERT above and left alone by the ON CONFLICT, so this is true exactly
  // once. Someone who reads a profile years later must not re-credit anybody.
  if (user.created_at === now && user.referred_by === null) {
    try {
      await creditReferrer(db, user.id, request.headers.get('Cookie'), now)
    } catch (error) {
      // A referral is a bonus, never a reason a sign-in fails.
      console.error('auth: could not credit referrer', String(error))
    }
  }

  const raw = await createSession(db, user.id, now)
  const target = safeRedirect(requestedTarget, origin)

  return redirect(`${origin}${target}`, [
    ...sessionCookieHeaders(raw, Math.floor(SESSION_TTL_MS / 1000), origin),
    oauthTempCookie(OAUTH_STATE_COOKIE, '', origin),
    oauthTempCookie(OAUTH_VERIFIER_COOKIE, '', origin),
  ])
}

/**
 * Credit whoever's public page sent this person here.
 *
 * The handle in the cookie is resolved to an account, the new row is stamped
 * with it, and if that took the referrer over the line they are given a month.
 * The count is read back from the table rather than incremented, so two
 * sign-ups landing at once cannot both think they were the third.
 */
async function creditReferrer(
  db: D1Database,
  newUserId: string,
  cookieHeader: string | null,
  now: number
): Promise<void> {
  const handle = normaliseHandle(readNamed(cookieHeader, REFERRAL_COOKIE))
  if (!handle) return

  const referrer = await db
    .prepare('SELECT id FROM users WHERE handle = ?')
    .bind(handle)
    .first<{ id: string }>()
  if (!referrer || referrer.id === newUserId) return

  await db
    .prepare('UPDATE users SET referred_by = ? WHERE id = ?')
    .bind(referrer.id, newUserId)
    .run()

  const count = await db
    .prepare('SELECT COUNT(*) AS n FROM users WHERE referred_by = ?')
    .bind(referrer.id)
    .first<{ n: number }>()

  if ((count?.n ?? 0) % REFERRALS_PER_MONTH === 0) {
    await grantMonths(db, referrer.id, 1, now)
  }
}

// Local readers, so google.ts owns the cookie names and this file does not
// re-derive them.
function readState(header: string | null): string | null {
  return readNamed(header, OAUTH_STATE_COOKIE)
}
function readVerifier(header: string | null): string | null {
  return readNamed(header, OAUTH_VERIFIER_COOKIE)
}
function readNamed(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== name) continue
    return part.slice(separator + 1).trim()
  }
  return null
}

/** POST /api/auth/refresh */
export async function handleRefresh(
  request: Request,
  db: D1Database
): Promise<Response> {
  const secret = process.env.SESSION_TOKEN_SECRET?.trim()
  if (!secret) {
    return json(
      {
        success: false,
        error: 'Sign-in is not configured on this deployment.',
      },
      503
    )
  }

  const origin = new URL(request.url).origin
  const now = Date.now()
  const user = await loadSession(db, sessionCookieOf(request), now)

  if (!user) {
    // Clear the hint too, so a client holding a stale one stops rendering an
    // avatar for a session that no longer exists.
    return json(
      { success: false, error: 'Not signed in' },
      401,
      clearCookieHeaders(origin)
    )
  }

  const pro = isEntitled(user, now)
  const exp = now + ACCESS_TOKEN_TTL_MS
  const token = await signToken({ u: user.id, exp, p: pro }, secret)

  return json({
    success: true,
    token,
    expiresAt: exp,
    userId: user.id,
    pro,
    email: user.email,
    name: user.name,
    picture: user.picture,
    createdAt: user.created_at,
    plan: {
      status: user.sub_status,
      variant: user.sub_variant,
      renewsAt: user.sub_renews_at,
      endsAt: user.sub_ends_at,
      pastDueSince: user.sub_past_due_since,
      // What actually entitles them today. The plan card needs to tell a
      // supporter apart from a lapsed subscription, and with Buy Me a Coffee the
      // grant is the only live source.
      granted: (user.grants ?? '').includes('pro'),
    },
    prefs: user.prefs,
  })
}

/** POST /api/auth/logout */
export async function handleLogout(
  request: Request,
  db: D1Database
): Promise<Response> {
  const url = new URL(request.url)
  const raw = sessionCookieOf(request)
  const all = url.searchParams.get('all') === '1'

  if (all) {
    const user = await loadSession(db, raw, Date.now())
    if (user) await deleteAllSessions(db, user.id)
  } else {
    await deleteSession(db, raw)
  }

  return json({ success: true }, 200, clearCookieHeaders(url.origin))
}

/**
 * The preferences an account may store. An allowlist with per-key validation,
 * because this is written straight from a request body into a column that is
 * read back into the page: anything not named here is dropped rather than
 * persisted.
 */
const ACCENTS = ['default', 'ember', 'ocean', 'forest', 'violet', 'rose']
const DENSITIES = ['comfortable', 'compact']

export function normalisePrefs(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return {}
  if (typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  const out: Record<string, unknown> = {}

  if (typeof input.accent === 'string' && ACCENTS.includes(input.accent)) {
    out.accent = input.accent
  }
  if (typeof input.density === 'string' && DENSITIES.includes(input.density)) {
    out.density = input.density
  }
  if (typeof input.autoNext === 'boolean') out.autoNext = input.autoNext
  if (typeof input.alerts === 'boolean') out.alerts = input.alerts
  if (typeof input.spoilerFree === 'boolean')
    out.spoilerFree = input.spoilerFree
  if (
    typeof input.region === 'string' &&
    ALERT_REGION_IDS.includes(input.region)
  ) {
    out.region = input.region
  }
  // Dropped rather than rejected when malformed, and capped hard: this is the
  // only pref that is a list, so it is the only one that could grow the column
  // without bound. See lib/filter-presets.ts.
  if (input.presets !== undefined) {
    const presets = normalisePresets(input.presets)
    if (presets.length > 0) out.presets = presets
  }
  // Alert pacing. Both only decide whether a device makes a NOISE — the
  // notification row is written either way, so neither can lose an alert.
  if (typeof input.digest === 'boolean') out.digest = input.digest
  if (input.quiet !== undefined) {
    const quiet = normaliseQuietHours(input.quiet)
    if (quiet) out.quiet = quiet
  }
  if (typeof input.source === 'string' && input.source.length <= 40) {
    out.source = input.source
  }
  // The opt-in for the supporters-only player trial. A boolean, so it cannot
  // grow the column or carry anything but its own meaning; whether it grants
  // anything is decided by entitlement at read time, never by this flag.
  if (typeof input.richPlayer === 'boolean') out.richPlayer = input.richPlayer
  // Reely Player preferences. Both values are from closed sets, so neither
  // can grow the column or smuggle markup into the player URL.
  if (input.playback !== undefined && input.playback !== null) {
    if (typeof input.playback === 'object' && !Array.isArray(input.playback)) {
      const pb = input.playback as Record<string, unknown>
      const playback: Record<string, unknown> = {}
      if (
        pb.sub === 'off' ||
        (typeof pb.sub === 'string' && /^[a-z]{2}$/.test(pb.sub))
      ) {
        playback.sub = pb.sub
      }
      if (pb.subSize === 's' || pb.subSize === 'm' || pb.subSize === 'l') {
        playback.subSize = pb.subSize
      }
      if (Object.keys(playback).length > 0) out.playback = playback
    }
  }
  return out
}

/** POST /api/account — { prefs } to save, { delete: true } to close the account. */
export async function handleAccount(
  request: Request,
  db: D1Database
): Promise<Response> {
  const url = new URL(request.url)
  const now = Date.now()
  const user = await loadSession(db, sessionCookieOf(request), now)
  if (!user) return json({ success: false, error: 'Not signed in' }, 401)

  let body: { prefs?: unknown; delete?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ success: false, error: 'Invalid request body' }, 400)
  }

  if (body.delete === true) {
    // Refuse while a SUBSCRIPTION is still entitling: deleting the row cancels
    // nothing at the provider, so it would keep billing with no way to restore
    // access. A Buy Me a Coffee grant has no such problem — it is not a
    // recurring charge this site can strand — so `isProAt`, not `isEntitled`.
    if (isProAt(user, now)) {
      return json(
        {
          success: false,
          error:
            'Cancel your subscription first. Deleting the account now would leave it billing you with no way to restore your library.',
        },
        409
      )
    }

    // Sessions, sync rows, lists, push subscriptions and notifications all
    // cascade from this one delete.
    await db.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run()
    return json({ success: true }, 200, clearCookieHeaders(url.origin))
  }

  const prefs = normalisePrefs(body.prefs)
  if (!prefs) return json({ success: false, error: 'Invalid preferences' }, 400)

  await db
    .prepare('UPDATE users SET prefs = ? WHERE id = ?')
    .bind(JSON.stringify(prefs), user.id)
    .run()

  return json({ success: true, prefs })
}
