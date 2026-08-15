/**
 * A minimal signed token, and the two crypto primitives the auth layer shares.
 *
 * Deliberately not a JWT: no library, no algorithm negotiation, no header to get
 * wrong. Payload plus HMAC-SHA256, base64url, verified with WebCrypto — which
 * exists in workerd, in Node 18+, and in the browser, so the same code runs
 * everywhere this project deploys.
 *
 * The token carries the entitlement bit so that a request can be answered
 * without a database read. Reely's write paths authenticate with the session
 * cookie instead (they are not hot enough to need this), but the client holds
 * the token because its `p` claim is what the UI paints supporter state from,
 * and because any future hot path gets the cheap check for free.
 */

export interface TokenPayload {
  /** The user's id. Opaque to the client; only ever compared, never displayed. */
  u: string
  /** Absolute expiry, epoch milliseconds. */
  exp: number
  /** Whether this user is a supporter right now. */
  p: boolean
}

/**
 * Fifteen minutes: long enough that an active visitor refreshes at most four
 * times an hour, short enough to bound how stale an entitlement can get.
 *
 * "Bound", not "revoke". Nothing re-checks an issued token against the database,
 * so signing out everywhere or losing a grant leaves a window of up to one TTL
 * in which a minted token still reads as entitled.
 */
export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000

const encoder = new TextEncoder()

// Exported because the OAuth flow needs both: base64url is what a PKCE challenge
// and a JWT segment are each written in.
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Padding is optional on the way in: `atob` implements WHATWG forgiving-base64,
 * which restores it. Both callers produce unpadded base64url — this module's own
 * tokens, and Google's ID tokens.
 */
// `Uint8Array<ArrayBuffer>`, not a bare `Uint8Array`: since TS 5.7 the bare form
// widens to `ArrayBufferLike`, which includes SharedArrayBuffer and so is not
// assignable to the `BufferSource` that crypto.subtle and pushManager.subscribe
// take. The array here is always a plain ArrayBuffer — this only says so.
export function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

export async function signToken(
  payload: TokenPayload,
  secret: string
): Promise<string> {
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)))
  const key = await hmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`
}

/**
 * Comfortably above a real token (~140 chars). Rejecting oversized input before
 * any decode or HMAC work keeps the path bounded regardless of what fronts the
 * Worker.
 */
const MAX_TOKEN_LENGTH = 512

export async function verifyToken(
  token: unknown,
  secret: string,
  now: number
): Promise<TokenPayload | null> {
  if (typeof token !== 'string') return null
  if (token.length > MAX_TOKEN_LENGTH) return null

  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, signature] = parts
  if (!body || !signature) return null

  try {
    const key = await hmacKey(secret)
    // Constant-time, so this is not a comparison a caller can time their way
    // through.
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signature),
      encoder.encode(body)
    )
    if (!valid) return null

    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(body))
    ) as TokenPayload

    if (
      typeof payload?.u !== 'string' ||
      typeof payload?.exp !== 'number' ||
      typeof payload?.p !== 'boolean'
    ) {
      return null
    }
    if (payload.exp <= now) return null
    // Bounds the blast radius of a mis-issued token (an arithmetic slip, a
    // seconds/millis mixup): nothing is trusted for longer than one TTL from the
    // moment it is checked, whatever `exp` the signer put in it.
    if (payload.exp - now > ACCESS_TOKEN_TTL_MS) return null
    return payload
  } catch {
    return null
  }
}

/**
 * SHA-256, hex-encoded. Session cookie values and push endpoints are stored as
 * this rather than as themselves.
 */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
