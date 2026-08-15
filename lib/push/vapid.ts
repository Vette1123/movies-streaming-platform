/**
 * Web push, without the encryption.
 *
 * A push message may carry an encrypted payload, and doing that properly is
 * ECDH + HKDF + AES128GCM — roughly 150 lines of crypto that has to be exactly
 * right or the browser silently drops the message. This sends a message with NO
 * payload instead: the service worker wakes, fetches `/api/push/pending` with
 * its own cookies, and renders whatever is queued.
 *
 * That removes the encryption entirely, and it is better in one way that matters
 * beyond effort: the notification text is produced at display time, so an alert
 * that has stopped being true between the send and the wake is simply never
 * shown.
 *
 * What is left is VAPID: a short-lived ES256 JWT proving the push came from this
 * application server. Forty lines of WebCrypto, no dependency.
 */

import { base64UrlDecode, base64UrlEncode } from '@/lib/token'

const encoder = new TextEncoder()

/**
 * Twelve hours. Push services reject a `exp` more than 24 hours out, and a
 * shorter life bounds what a leaked header is worth. The JWT is per-audience —
 * one per push service origin — so it is minted per send rather than cached;
 * signing costs microseconds.
 */
const JWT_TTL_SECONDS = 12 * 60 * 60

/**
 * The private key as WebCrypto wants it.
 *
 * `VAPID_PRIVATE_KEY` is the 32-byte scalar and `VAPID_PUBLIC_KEY` the 65-byte
 * uncompressed point, both base64url — the format every web-push tool emits and
 * the one the browser's `applicationServerKey` expects. WebCrypto will not
 * import either directly, so they are reassembled into a JWK here.
 */
async function importSigningKey(
  publicKey: string,
  privateKey: string
): Promise<CryptoKey> {
  const point = base64UrlDecode(publicKey)
  if (point.length !== 65 || point[0] !== 4) {
    throw new Error('VAPID_PUBLIC_KEY is not an uncompressed P-256 point')
  }
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: base64UrlEncode(point.slice(1, 33)),
      y: base64UrlEncode(point.slice(33, 65)),
      d: privateKey,
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
}

/**
 * The VAPID `Authorization` header for one push service origin.
 *
 * `aud` is the ORIGIN of the endpoint, not the endpoint itself — a JWT audience
 * scoped to the full URL is rejected by every implementation.
 */
export async function vapidHeader(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string,
  now: number
): Promise<string> {
  const header = base64UrlEncode(
    encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  )
  const payload = base64UrlEncode(
    encoder.encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(now / 1000) + JWT_TTL_SECONDS,
        sub: subject,
      })
    )
  )

  const key = await importSigningKey(publicKey, privateKey)
  // WebCrypto's ECDSA output is already the raw r‖s pair JWS wants; a DER
  // signature would have to be unwrapped first, which is the usual trap here.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(`${header}.${payload}`)
  )

  const jwt = `${header}.${payload}.${base64UrlEncode(new Uint8Array(signature))}`
  return `vapid t=${jwt}, k=${publicKey}`
}

export interface PushSubscriptionRow {
  id: string
  endpoint: string
}

export type PushResult = 'sent' | 'gone' | 'failed'

/**
 * One payloadless push.
 *
 * `gone` means the browser is never coming back (the subscription was revoked or
 * the profile was wiped); the caller deletes the row. Anything else is transient
 * and is retried by the next sweep rather than by us.
 */
export async function sendPush(
  endpoint: string,
  subject: string,
  publicKey: string,
  privateKey: string,
  now: number
): Promise<PushResult> {
  try {
    const audience = new URL(endpoint).origin
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidHeader(
          audience,
          subject,
          publicKey,
          privateKey,
          now
        ),
        // A day: long enough to survive a phone that is asleep overnight, short
        // enough that "a new episode is out" never arrives stale.
        TTL: '86400',
        'Content-Length': '0',
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (response.status === 404 || response.status === 410) return 'gone'
    return response.ok ? 'sent' : 'failed'
  } catch {
    return 'failed'
  }
}
