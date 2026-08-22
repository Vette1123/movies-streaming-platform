// Entry-ticket signing for the private playback worker.
//
// Mirrors reely-pro-player/src/tokens.mjs EXACTLY — same payload shape, same
// base64url framing, same HMAC-SHA256 — because that worker verifies what we
// mint here. The two halves must never drift: a field added here without
// there is a 403 every visitor can see.
//
// This module runs inside cloudflare/worker.js only. The secret lives in
// wrangler secrets (PLAYBACK_TICKET_SECRET here, TICKET_SECRET there) and is
// the reason a cloned Reely cannot use our player: forks have no secret and
// no way to mint a signature this worker accepts.

const enc = new TextEncoder()

/** Short by design: one exchange, then the play token carries playback. */
export const ENTRY_TICKET_TTL_S = 90

const b64url = (bytes: Uint8Array): string => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const hmac = async (
  secretB64: string,
  data: string,
): Promise<Uint8Array> => {
  const pad = secretB64.length % 4 === 0 ? '' : '='.repeat(4 - (secretB64.length % 4))
  const raw = atob(secretB64.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const key = await crypto.subtle.importKey(
    'raw',
    Uint8Array.from(raw, (c) => c.charCodeAt(0)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, enc.encode(data)),
  )
}

export interface PlaybackTarget {
  type: 'movie' | 'tv'
  id: number
  season?: number
  episode?: number
}

/**
 * Mint `base64url(payload).base64url(sig)` for one title. Returns null when
 * the secret is not configured, so callers answer 503 instead of shipping a
 * token that the player would reject.
 */
export const signEntryTicket = async (
  secret: string | undefined,
  target: PlaybackTarget,
): Promise<string | null> => {
  if (!secret) return null
  const body = {
    k: 't',
    ty: target.type,
    id: target.id,
    ...(target.type === 'tv'
      ? { s: target.season ?? 1, ep: target.episode ?? 1 }
      : {}),
    exp: Math.floor(Date.now() / 1000) + ENTRY_TICKET_TTL_S,
  }
  const json = b64url(enc.encode(JSON.stringify(body)))
  const sig = await hmac(secret, json)
  return `${json}.${b64url(sig)}`
}
