/**
 * The transport half of a signed webhook: read the body safely, then prove it
 * came from the sender. Nothing in here knows which provider it is serving.
 *
 * Deliberately free of imports so it can be copied between projects as-is — it
 * already has been, which is why it is a file rather than two functions inside
 * the Buy Me a Coffee handler.
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// Uint8Array<ArrayBuffer> rather than a bare Uint8Array — see the note on
// base64UrlDecode in lib/token.ts.
function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) return null
    bytes[i] = byte
  }
  return bytes
}

/**
 * HMAC-SHA256 over the raw body, hex-encoded, compared with
 * `crypto.subtle.verify`, which is constant-time. Never skipped in any
 * environment: an unverified webhook endpoint lets anyone grant themselves
 * supporter status.
 */
export async function verifyWebhookSignature(
  raw: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature) return false
  const bytes = hexToBytes(signature.trim())
  if (!bytes) return false

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(raw))
}

/**
 * Comfortably above a real webhook payload (a few KB) and far below anything
 * that costs a measurable slice of the 10 ms CPU budget.
 */
export const MAX_WEBHOOK_BYTES = 64 * 1024

/**
 * The body, or null if it exceeds `limit`.
 *
 * Read as a bounded stream rather than `request.text()`. The signature is not
 * known good at this point — a header of `00` is valid hex and survives
 * `hexToBytes` — so an unauthenticated caller must not be able to make us decode,
 * or HMAC, an arbitrarily large body. `Content-Length` is only an early-out; the
 * stream cut-off is what actually bounds the work, since a chunked request has
 * no declared length to trust.
 */
export async function readBounded(
  request: Request,
  limit: number
): Promise<string | null> {
  if (Number(request.headers.get('Content-Length')) > limit) return null

  const reader = request.body?.getReader()
  if (!reader) return ''

  const buffer = new Uint8Array(limit)
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (size + value.byteLength > limit) {
      await reader.cancel()
      return null
    }
    buffer.set(value, size)
    size += value.byteLength
  }
  return decoder.decode(buffer.subarray(0, size))
}
