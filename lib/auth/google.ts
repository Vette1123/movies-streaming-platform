/**
 * The Google half of sign-in: OAuth 2.0 authorization code with PKCE.
 *
 * No library. `arctic` was the obvious candidate and was measured out of the
 * sibling project: wrangler emits a single-file bundle, so even a dynamically
 * imported module is COMPILED at isolate startup, and arctic ships a client for
 * every provider it supports — 123 KB of Coinbase, Withings and Kick to reach
 * the one we use. That compile is billed to whichever request created the
 * isolate, which here is a stranger's `/api/search`. Removing it halved that
 * bundle and took a third off isolate startup. It is also deprecated upstream.
 *
 * What replaces it is the flow itself: a URL, a form POST, and a base64url
 * decode. Nothing here is Google-specific beyond the two endpoints.
 */

import { base64UrlDecode, base64UrlEncode } from '@/lib/token'

export { OAUTH_STATE_COOKIE, OAUTH_VERIFIER_COOKIE } from './cookies'

/**
 * How long the state and PKCE verifier survive.
 *
 * This bounds the round trip through Google, and ten minutes is too tight for
 * it: an account picker, a password, a 2FA prompt and a consent screen on a
 * phone is easily longer than that, and when the cookie expires mid-flow the
 * callback cannot tell that apart from a forged request — so a legitimate
 * sign-in fails.
 *
 * Half an hour costs little. Both values are single-use, HttpOnly, SameSite=Lax,
 * cleared on success and failure alike, and the verifier is useless without the
 * authorization code, which Google expires far sooner than this.
 */
const OAUTH_TEMP_TTL_SECONDS = 30 * 60

/** See `secureAttribute` in session.ts — http://localhost drops `Secure`. */
function secureAttribute(origin: string): string {
  return origin.startsWith('http://') ? '' : '; Secure'
}

export function oauthTempCookie(
  name: string,
  value: string,
  origin: string
): string {
  const age = value === '' ? 0 : OAUTH_TEMP_TTL_SECONDS
  return `${name}=${value}; Path=/; Max-Age=${age}${secureAttribute(origin)}; SameSite=Lax; HttpOnly`
}

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

/**
 * `profile` rides along with openid + email so the account control can show the
 * visitor's own Google avatar and name instead of a generic pill. Both are
 * cosmetic: nothing about entitlement reads them.
 */
const SCOPES = 'openid email profile'

/**
 * Google answers the token endpoint in well under a second; ten is the bound
 * past which the visitor is staring at a blank tab either way. Without a timeout
 * a hung Google holds the request open until the platform kills it.
 */
const TOKEN_EXCHANGE_TIMEOUT_MS = Number(process.env.OAUTH_TIMEOUT_MS) || 10_000

/**
 * The redirect URI, which must match the one registered with Google EXACTLY and
 * must be identical in the authorization and the token request. Mismatched
 * values between dev and production are the single most likely thing to break in
 * this whole flow.
 */
function callbackUrl(origin: string): string {
  return `${origin}/api/auth/callback`
}

/**
 * 256 bits of CSPRNG output, base64url.
 *
 * Serves as both the state token and the PKCE code verifier. As a verifier it is
 * 43 characters of the unreserved charset, the shortest RFC 7636 allows and
 * exactly what the spec recommends generating.
 */
export function randomToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)))
}

/** Where to send the browser to sign in. */
export async function createAuthorizationUrl(
  origin: string,
  state: string,
  verifier: string
): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  )

  const url = new URL(AUTHORIZATION_ENDPOINT)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID ?? '')
  url.searchParams.set('redirect_uri', callbackUrl(origin))
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('state', state)
  url.searchParams.set(
    'code_challenge',
    base64UrlEncode(new Uint8Array(digest))
  )
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

/**
 * Redeem the authorization code for an ID token.
 *
 * Throws on every non-answer, which is what the caller wants: `invalid_grant` —
 * the ordinary response to a code some other delivery of the same callback
 * already redeemed — has to reach the caller's catch so it can ask whether a
 * session exists rather than report a failure.
 */
export async function exchangeAuthorizationCode(
  origin: string,
  code: string,
  verifier: string
): Promise<string> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl(origin),
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(TOKEN_EXCHANGE_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(
      `Google rejected the authorization code (${response.status})`
    )
  }

  const body = (await response.json()) as { id_token?: unknown }
  if (typeof body.id_token !== 'string' || !body.id_token) {
    throw new Error('Google returned no ID token')
  }
  return body.id_token
}

/**
 * The claims out of an ID token, decoded and NOT signature-verified.
 *
 * That is correct here and only here: this token arrived over TLS as the direct
 * response to a server-side request authenticated with our client secret, so
 * there is no untrusted path it could have travelled. A token from anywhere else
 * would have to be verified against Google's JWKS.
 *
 * `TextDecoder` rather than `atob` alone, because a display name is UTF-8.
 */
export function decodeIdToken(idToken: string): unknown {
  const payload = idToken.split('.')[1]
  if (!payload) throw new Error('Malformed ID token')
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)))
}

/**
 * Where to send someone after signing in.
 *
 * An unvalidated redirect parameter on an auth endpoint is a textbook open
 * redirect, and phishing through the sign-in flow is more damaging than anywhere
 * else on the site: the victim has just been asked for credentials, so a hostile
 * landing page is maximally believable. Anything not provably on our own origin
 * becomes "/".
 *
 * Resolving against `origin` catches the awkward cases — a protocol-relative
 * `//evil.example` parses as another origin rather than a path, and
 * `javascript:` never matches. The origin check alone is not enough though:
 * `/..//evil.example` resolves to a pathname of `//evil.example` ON our origin,
 * which passes that check and then reads as protocol-relative again the moment
 * it is used as a bare `Location`. So the result is forced to a single leading
 * slash.
 */
export function safeRedirect(target: string | null, origin: string): string {
  if (!target) return '/'
  try {
    const url = new URL(target, origin)
    if (url.origin !== origin) return '/'
    return `/${url.pathname.replace(/^\/+/, '')}${url.search}`
  } catch {
    return '/'
  }
}
