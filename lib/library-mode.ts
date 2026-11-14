// Own-library mode: the piece of playback that is entirely ours.
//
// Everything else in the chain reaches outward — TMDB for the catalog, the
// provider for the bytes, the relay for the walk — and each of those can be
// gated, rotated or shut off by someone else. This module is the counterpart:
// media Reely hosts itself, catalogued in D1 and served by the site Worker
// through signed URLs, so the serving half never depends on a third party
// staying friendly.
//
// D1 is the byte store (R2 needs a payment method on file; D1 is already on
// the account). SQLite caps a single BLOB row at 2 MB, so files are split
// into CHUNK_SIZE pieces here and reassembled per request; the half that puts
// them in is scripts/library-ingest.mjs.
//
// lib/library-sync.ts is a different library — the visitor's saved titles.
// This one is playback.

export interface LibraryTarget {
  ty: 'movie' | 'tv'
  id: number
  /** TV only. Defaults to 1, matching the player's own token defaults. */
  s?: number
  ep?: number
}

/** One chunk of library_blobs. The D1 cap on a single BLOB row is 2 MB. */
export const CHUNK_SIZE = 1024 * 1024

/**
 * Ingest refuses anything bigger, so one playback request reads a bounded
 * number of rows and stays well inside the 50 MB query-result limit.
 */
export const MAX_FILE_BYTES = 12 * CHUNK_SIZE

/** How long a play URL works. Matches the player's play token (4 hours). */
export const LIBRARY_TOKEN_TTL_S = 4 * 60 * 60

/**
 * The identity of one playable unit: a movie, or one TV episode.
 * Returns null for anything a token claim or an ingest call could throw at
 * it — the caller turns null into 400/401 rather than trusting a shape.
 */
export function mediaKey(t: {
  ty?: unknown
  id?: unknown
  s?: unknown
  ep?: unknown
}): string | null {
  if (t.ty !== 'movie' && t.ty !== 'tv') return null
  if (
    typeof t.id !== 'number' ||
    !Number.isInteger(t.id) ||
    t.id < 1 ||
    t.id > 1e9
  )
    return null
  if (t.ty === 'movie') return `movie:${t.id}`
  const s = t.s === undefined ? 1 : t.s
  const ep = t.ep === undefined ? 1 : t.ep
  if (typeof s !== 'number' || !Number.isInteger(s) || s < 1) return null
  if (typeof ep !== 'number' || !Number.isInteger(ep) || ep < 1) return null
  return `tv:${t.id}:${s}:${ep}`
}

/** The inverse of mediaKey, for ingest calls that carry a media key directly. */
export function parseMediaKey(media: unknown): LibraryTarget | null {
  if (typeof media !== 'string') return null
  const m = /^(movie|tv):(\d+)(?::(\d+):(\d+))?$/.exec(media)
  if (!m) return null
  if (m[1] === 'movie') return { ty: 'movie', id: Number(m[2]) }
  // A TV key names both halves; 'tv:1399' alone is not a playable unit.
  if (m[3] === undefined) return null
  return { ty: 'tv', id: Number(m[2]), s: Number(m[3]), ep: Number(m[4]) }
}

/**
 * The storage prefix every file of one unit lives under. Segment paths from
 * the manifest are relative and join onto this, so the key space mirrors the
 * HLS tree exactly.
 */
export function mediaPrefix(media: string): string | null {
  const t = parseMediaKey(media)
  if (!t) return null
  return t.ty === 'movie' ? `movie/${t.id}` : `tv/${t.id}/${t.s}-${t.ep}`
}

/**
 * The only paths a play URL may carry. hls.js joins manifest-relative URIs
 * against the manifest URL, so a hostile or corrupted manifest could try
 * traversal — this refuses everything but plain tree-internal paths.
 */
export function safeRelPath(input: unknown): string | null {
  if (typeof input !== 'string' || !input || input.length > 256) return null
  if (input.includes('\\') || input.includes('\0') || input.includes('%'))
    return null
  if (input.startsWith('/')) return null
  const parts = input.split('/')
  if (parts.length > 4) return null
  for (const part of parts) {
    if (part === '.' || part === '..') return null
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(part)) return null
  }
  return parts.join('/')
}

export function contentTypeFor(path: string): string {
  if (path.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl'
  if (path.endsWith('.ts')) return 'video/mp2t'
  if (path.endsWith('.m4s')) return 'video/iso-bmff'
  if (path.endsWith('.mp4')) return 'video/mp4'
  if (path.endsWith('.vtt') || path.endsWith('.webvtt')) return 'text/vtt'
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg'
  if (path.endsWith('.png')) return 'image/png'
  return 'application/octet-stream'
}

/** The library_files.kind column: what a path is for, in one field. */
export function fileKindFor(path: string): 'playlist' | 'segment' | 'other' {
  if (path.endsWith('.m3u8')) return 'playlist'
  if (path.endsWith('.ts') || path.endsWith('.m4s') || path.endsWith('.mp4'))
    return 'segment'
  return 'other'
}

export interface ByteRange {
  /** Inclusive. Both fit inside the file (parseRange clamps the end). */
  start: number
  end: number
}

/**
 * One Range header, parsed against a known file size.
 *   null        no usable header — serve the whole file (this is also the
 *               answer for multi-range and malformed headers: RFC 9110 lets a
 *               server ignore an unsupported Range, and hls.js sends one)
 *   'invalid'   syntactically fine but impossible — start past the end — and
 *               the caller answers 416
 */
export function parseRange(
  header: string | null | undefined,
  size: number
): ByteRange | null | 'invalid' {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!m) return null
  const [, first, last] = m
  if (first === '' && last === '') return null
  if (first === '') {
    // Suffix form: the last N bytes.
    const n = Number(last)
    if (n === 0) return null
    return { start: Math.max(0, size - n), end: size - 1 }
  }
  const start = Number(first)
  if (start >= size) return 'invalid'
  const end = last === '' ? size - 1 : Math.min(Number(last), size - 1)
  if (end < start) return null
  return { start, end }
}

/** The first blob row a byte offset lives in. */
export function firstChunkFor(offset: number): number {
  return Math.floor(offset / CHUNK_SIZE)
}

/** The last blob row a byte offset (exclusive) lives in. */
export function lastChunkFor(endExclusive: number): number {
  return Math.max(0, Math.ceil(endExclusive / CHUNK_SIZE) - 1)
}

// ---- Tokens ----------------------------------------------------------------
//
// `base64url(json).base64url(hmac-sha256)`, byte for byte the framing of the
// player worker's tokens (reely-pro-player/src/tokens.mjs) and our entry
// tickets (lib/pro/playback-ticket.ts). Two kinds share one secret:
//
//   k:"p"  play token   minted by the player worker after the entry ticket
//                       cleared entitlement — the proof /api/library/play
//                       consumes
//   k:"l"  library URL  minted by /api/library/play — the proof every
//                       manifest and segment request of one playback carries
//
// The kinds are checked, not assumed: a play token must not open a play URL
// and vice versa, so a leaked one is useless for the other.

const enc = new TextEncoder()

const b64url = (bytes: Uint8Array): string => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromB64url = (value: string): Uint8Array<ArrayBuffer> => {
  const pad = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4))
  const bin = atob(value.replace(/-/g, '+').replace(/_/g, '/') + pad)
  // atob hands back a fresh binary string; the view over it is a plain
  // ArrayBuffer (TS 7 wants the generic said out loud).
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>
}

/** HMAC-SHA256 over `data` with the base64url-encoded shared secret. */
const hmac = async (secretB64: string, data: string): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey(
    'raw',
    fromB64url(secretB64),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  // TextEncoder.encode allocates its own ArrayBuffer; TS 7's BufferSource
  // wants that said out loud.
  const bytes = enc.encode(data) as Uint8Array<ArrayBuffer>
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, bytes))
}

export interface TokenClaims extends LibraryTarget {
  k: 'l' | 'p'
  exp: number
}

async function signKind(
  secret: string | undefined,
  kind: 'l' | 'p',
  target: LibraryTarget,
  ttlS: number
): Promise<string | null> {
  if (!secret) return null
  const body: Record<string, unknown> = {
    k: kind,
    ty: target.ty,
    id: target.id,
  }
  if (target.s !== undefined) body.s = target.s
  if (target.ep !== undefined) body.ep = target.ep
  body.exp = Math.floor(Date.now() / 1000) + ttlS
  const json = b64url(enc.encode(JSON.stringify(body)))
  const sig = await hmac(secret, json)
  return `${json}.${b64url(sig)}`
}

/** The URL token /api/library/play mints; every HLS request of a playback carries it. */
export function signLibraryToken(
  secret: string | undefined,
  target: LibraryTarget,
  ttlS: number = LIBRARY_TOKEN_TTL_S
): Promise<string | null> {
  return signKind(secret, 'l', target, ttlS)
}

async function verifyKind(
  secret: string | undefined,
  token: unknown,
  kinds: readonly string[],
  nowS: number
): Promise<TokenClaims | null> {
  if (!secret || typeof token !== 'string' || !token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const json = token.slice(0, dot)
  let expected: Uint8Array
  try {
    expected = await hmac(secret, json)
  } catch {
    return null
  }
  let given: Uint8Array
  try {
    given = fromB64url(token.slice(dot + 1))
  } catch {
    return null
  }
  // Constant-time-enough compare: length first, then fold both directions.
  if (given.length !== expected.length) return null
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ given[i]
  if (diff !== 0) return null
  let claims: TokenClaims | null = null
  try {
    const parsed = JSON.parse(
      new TextDecoder().decode(fromB64url(json))
    ) as TokenClaims
    if (parsed && typeof parsed.exp === 'number' && kinds.includes(parsed.k))
      claims = parsed
  } catch {
    return null
  }
  if (!claims || claims.exp <= nowS) return null
  // The claims must BE a playable unit, not just carry fields: a tampered or
  // future-incompatible payload fails here instead of building a half key.
  if (mediaKey(claims) === null) return null
  return claims
}

export function verifyLibraryToken(
  secret: string | undefined,
  token: unknown,
  nowS: number = Math.floor(Date.now() / 1000)
): Promise<TokenClaims | null> {
  return verifyKind(secret, token, ['l'], nowS)
}

/** The player worker's play token (tokens.mjs), which /api/library/play consumes. */
export function verifyPlayToken(
  secret: string | undefined,
  token: unknown,
  nowS: number = Math.floor(Date.now() / 1000)
): Promise<TokenClaims | null> {
  return verifyKind(secret, token, ['p'], nowS)
}
