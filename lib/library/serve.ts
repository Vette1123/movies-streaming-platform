// The routes behind own-library mode, as plain request → Response handlers the
// Worker's fetch calls directly. Auth is two signed tokens and one shared
// ingest key, and none of them reads a user from D1:
//
//   /api/library/play         POST   the player worker calls it, carrying the
//                                    play token it minted after the entry
//                                    ticket cleared entitlement — the
//                                    entitlement decision already happened
//   /api/library/hls/<tok>/…  GET    browser requests from the player; every
//                                    one carries the URL token play minted
//   /api/library/ingest/…     PUT/POST/DELETE   scripts/library-ingest.mjs,
//                                    machine to machine
//
// A title NOT in the library answers 404, never an error page: 404 is the
// "fall through to the provider tiers" signal the playback chain reads.

import {
  CHUNK_SIZE,
  contentTypeFor,
  fileKindFor,
  firstChunkFor,
  lastChunkFor,
  MAX_FILE_BYTES,
  mediaKey,
  mediaPrefix,
  parseMediaKey,
  parseRange,
  safeRelPath,
  signLibraryToken,
  verifyLibraryToken,
  verifyPlayToken,
  type LibraryTarget,
  type TokenClaims,
} from '@/lib/library-mode'

interface LibraryEnv {
  DB?: D1Database
  PLAYBACK_TICKET_SECRET?: string
  LIBRARY_TOKEN_SECRET?: string
  LIBRARY_INGEST_TOKEN?: string
  LIBRARY_PLAYER_ORIGIN?: string
}

const json = (
  data: unknown,
  status: number,
  extra?: Record<string, string>
): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      // Every answer is keyed to a token or a media row: nothing here is
      // worth a cache serving it to the wrong playback.
      'cache-control': 'private, no-store',
      ...extra,
    },
  })

/**
 * The player runs on its own origin, so every manifest and segment fetch is
 * cross-origin. Reflect the one configured player origin — nothing else, and
 * only for requests that name it — rather than `*`, so a copied player URL
 * somewhere else still reads 403s.
 */
function corsOf(request: Request, env: LibraryEnv): Record<string, string> {
  const allowed = env.LIBRARY_PLAYER_ORIGIN
  const origin = request.headers.get('origin')
  if (!allowed || !origin || origin !== allowed) return {}
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-headers': 'range',
    'access-control-allow-methods': 'GET, HEAD, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

const bearerOf = (request: Request): string | null => {
  const header = request.headers.get('authorization')
  if (!header) return null
  const m = /^Bearer (\S+)$/.exec(header)
  return m ? m[1] : null
}

/** Length-then-fold compare for the ingest key, same shape the tokens use. */
const constantEq = (given: string, secret: string): boolean => {
  if (given.length !== secret.length) return false
  let diff = 0
  for (let i = 0; i < secret.length; i++)
    diff |= given.charCodeAt(i) ^ secret.charCodeAt(i)
  return diff === 0
}

// ---- /api/library/play -----------------------------------------------------

export async function handleLibraryPlay(
  request: Request,
  env: LibraryEnv,
  url: URL
): Promise<Response> {
  const db = env.DB
  const playbackSecret = env.PLAYBACK_TICKET_SECRET
  const urlSecret = env.LIBRARY_TOKEN_SECRET
  if (!db || !playbackSecret || !urlSecret)
    return json({ error: 'library mode unavailable' }, 503)

  const claims = await verifyPlayToken(playbackSecret, bearerOf(request))
  const media = claims ? mediaKey(claims) : null
  if (!claims || !media) return json({ error: 'invalid play token' }, 401)

  const row = await db
    .prepare(
      'SELECT title, duration_s FROM library_media WHERE media = ? AND status = ?'
    )
    .bind(media, 'ready')
    .first<{ title: string | null; duration_s: number | null }>()
  if (!row) return json({ error: 'not in library', media }, 404)

  const token = await signLibraryToken(urlSecret, claims)
  if (!token) return json({ error: 'library mode unavailable' }, 503)

  const out: Record<string, unknown> = {
    sources: [
      {
        url: `${url.origin}/api/library/hls/${token}/${mediaPrefix(media)}/master.m3u8`,
      },
    ],
  }
  if (row.title) out.title = row.title
  if (row.duration_s) out.duration = row.duration_s
  return json(out, 200, corsOf(request, env))
}

// ---- /api/library/hls/<token>/<path> ---------------------------------------

export async function handleLibraryHls(
  request: Request,
  env: LibraryEnv,
  pathname: string
): Promise<Response> {
  const method = request.method
  if (method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsOf(request, env) })
  if (method !== 'GET' && method !== 'HEAD')
    return json({ error: 'method not allowed' }, 405)

  const urlSecret = env.LIBRARY_TOKEN_SECRET
  const db = env.DB
  if (!urlSecret || !db) return json({ error: 'library mode unavailable' }, 503)

  const m = /^\/api\/library\/hls\/([^/]+)\/(.+)$/.exec(pathname)
  // Percent-encoding has no legitimate use here (paths are ASCII tree names,
  // tokens are base64url): a `%2e%2e` traversal never gets to path checks.
  if (!m || m[2].includes('%')) return json({ error: 'bad path' }, 400)

  const claims: TokenClaims | null = await verifyLibraryToken(urlSecret, m[1])
  if (!claims) return json({ error: 'invalid library token' }, 403)

  const media = mediaKey(claims)
  const prefix = media ? mediaPrefix(media) : null
  if (!media || !prefix) return json({ error: 'bad path' }, 400)
  // The URL is '<prefix>/<tree path>', and the prefix must be the token's own:
  // a token for one title can never read another title's tree, whatever the
  // URL says.
  if (!m[2].startsWith(`${prefix}/`)) return json({ error: 'bad path' }, 400)
  const rel = safeRelPath(m[2].slice(prefix.length + 1))
  if (!rel) return json({ error: 'bad path' }, 400)
  const key = `${prefix}/${rel}`

  const file = await db
    .prepare(
      'SELECT content_type, size, chunks FROM library_files WHERE key = ?'
    )
    .bind(key)
    .first<{ content_type: string; size: number; chunks: number }>()
  if (!file) return json({ error: 'not found', key }, 404)

  const range = parseRange(request.headers.get('range'), file.size)
  if (range === 'invalid') {
    return json({ error: 'range not satisfiable' }, 416, {
      'content-range': `bytes */${file.size}`,
      'accept-ranges': 'bytes',
    })
  }
  const start = range ? range.start : 0
  const end = range ? range.end : file.size - 1
  const length = file.size === 0 ? 0 : end - start + 1

  const first = firstChunkFor(start)
  const last = lastChunkFor(end + 1)
  const result = await db
    .prepare(
      'SELECT seq, data FROM library_blobs WHERE key = ? AND seq BETWEEN ? AND ? ORDER BY seq'
    )
    .bind(key, first, last)
    .all<{ seq: number; data: ArrayBuffer | Uint8Array }>()
  const rows = result.results ?? []
  if (rows.length < last - first + 1) {
    // Blobs are uploaded before finalize writes the files row, so this is an
    // internal inconsistency, not a missing file: say so loudly.
    console.error('library file has missing chunks', {
      key,
      rows: rows.length,
      expected: last - first + 1,
    })
    return json({ error: 'incomplete file' }, 500)
  }

  const bytesOf = (d: ArrayBuffer | Uint8Array): Uint8Array =>
    d instanceof Uint8Array ? d : new Uint8Array(d)

  const headers: Record<string, string> = {
    'content-type': file.content_type,
    'content-length': String(length),
    'accept-ranges': 'bytes',
    'cache-control': 'private, no-store',
    ...corsOf(request, env),
  }
  if (range) headers['content-range'] = `bytes ${start}-${end}/${file.size}`

  if (method === 'HEAD')
    return new Response(null, { status: range ? 206 : 200, headers })

  const stream = new ReadableStream({
    start(controller) {
      // Rows arrive ordered by seq and cover the requested span contiguously;
      // each is clipped to the global window, which also serves the whole-file
      // case (every row passes unclipped).
      for (const row of rows) {
        const bytes = bytesOf(row.data)
        const from = Math.max(0, start - row.seq * CHUNK_SIZE)
        const to = Math.min(bytes.length, end + 1 - row.seq * CHUNK_SIZE)
        if (to > from) controller.enqueue(bytes.subarray(from, to))
      }
      controller.close()
    },
  })
  return new Response(stream, { status: range ? 206 : 200, headers })
}

// ---- /api/library/ingest/* -------------------------------------------------
//
// Three calls, all keyed by LIBRARY_INGEST_TOKEN (set it alongside the other
// wrangler secrets):
//
//   PUT    /api/library/ingest/file      one chunk of one file, base64 in JSON
//   POST   /api/library/ingest/finalize  the files rows + the playable row,
//                                        one batch, written after every chunk
//   DELETE /api/library/ingest           the whole unit (stale tree cleanup)
//
// The script always deletes before re-ingesting a unit, so a re-encoded tree
// cannot leave orphaned chunks behind.

interface IngestMedia {
  media: string
  prefix: string
  title: string | null
}

const mediaOf = (raw: unknown): IngestMedia | null => {
  // Accept the compact string form ('movie:550') or the explicit object form
  // ({ty,id,...}). Both validate through the same key builder: the object is
  // validated by mediaKey and re-read via parseMediaKey, so there is exactly
  // one place a shape is judged.
  const target: LibraryTarget | null =
    typeof raw === 'string'
      ? parseMediaKey(raw)
      : parseMediaKey(mediaKey((raw ?? {}) as Record<string, unknown>))
  if (!target) return null
  const media = mediaKey(target)
  const prefix = media ? mediaPrefix(media) : null
  if (!media || !prefix) return null
  const title =
    raw !== null &&
    typeof raw === 'object' &&
    typeof (raw as { title?: unknown }).title === 'string'
      ? ((raw as { title: string }).title as string).slice(0, 200)
      : null
  return { media, prefix, title }
}

const intIn = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

interface UploadFile {
  path: string
  contentType: string
  size: number
  chunks: number
}

export async function handleLibraryIngest(
  request: Request,
  env: LibraryEnv,
  pathname: string
): Promise<Response> {
  const db = env.DB
  const ingestKey = env.LIBRARY_INGEST_TOKEN
  if (!db || !ingestKey) return json({ error: 'library mode unavailable' }, 503)
  if (!constantEq(request.headers.get('x-library-key') ?? '', ingestKey))
    return json({ error: 'unauthorized' }, 401)

  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return json({ error: 'bad body' }, 400)
  const b = body as Record<string, unknown>

  if (request.method === 'PUT' && pathname === '/api/library/ingest/file') {
    const unit = mediaOf(b.media)
    const rel = safeRelPath(b.path)
    if (!unit || !rel) return json({ error: 'bad media or path' }, 400)
    if (
      !intIn(b.size, 1, MAX_FILE_BYTES) ||
      !intIn(b.chunks, 1, Math.ceil(MAX_FILE_BYTES / CHUNK_SIZE))
    )
      return json({ error: 'bad size' }, 400)
    if (b.chunks !== Math.ceil((b.size as number) / CHUNK_SIZE))
      return json({ error: 'bad chunk count' }, 400)
    if (!intIn(b.seq, 0, (b.chunks as number) - 1))
      return json({ error: 'bad seq' }, 400)
    if (typeof b.dataB64 !== 'string') return json({ error: 'bad data' }, 400)
    const expected =
      (b.seq as number) === (b.chunks as number) - 1
        ? (b.size as number) - ((b.chunks as number) - 1) * CHUNK_SIZE
        : CHUNK_SIZE
    let bytes: Uint8Array
    try {
      bytes = Uint8Array.from(atob(b.dataB64), (c) => c.charCodeAt(0))
    } catch {
      return json({ error: 'bad base64' }, 400)
    }
    if (bytes.length !== expected)
      return json({ error: 'bad chunk length' }, 400)
    const contentType =
      typeof b.contentType === 'string' && b.contentType.length <= 100
        ? b.contentType
        : contentTypeFor(rel)
    const key = `${unit.prefix}/${rel}`
    await db
      .prepare(
        'INSERT OR REPLACE INTO library_blobs (key, seq, data) VALUES (?, ?, ?)'
      )
      .bind(key, b.seq, bytes)
      .run()
    return json({ ok: true, key, seq: b.seq }, 200)
  }

  if (
    request.method === 'POST' &&
    pathname === '/api/library/ingest/finalize'
  ) {
    const unit = mediaOf(b.media)
    if (!unit) return json({ error: 'bad media' }, 400)
    if (!Array.isArray(b.files) || b.files.length === 0)
      return json({ error: 'bad files' }, 400)
    const seen = new Set<string>()
    const files: UploadFile[] = []
    for (const raw of b.files) {
      const f = raw as Record<string, unknown>
      const rel = safeRelPath(f.path)
      if (!rel || seen.has(rel)) return json({ error: 'bad file list' }, 400)
      seen.add(rel)
      if (
        !intIn(f.size, 1, MAX_FILE_BYTES) ||
        !intIn(f.chunks, 1, Math.ceil(MAX_FILE_BYTES / CHUNK_SIZE))
      )
        return json({ error: 'bad file size' }, 400)
      if (f.chunks !== Math.ceil((f.size as number) / CHUNK_SIZE))
        return json({ error: 'bad chunk count' }, 400)
      files.push({
        path: rel,
        contentType:
          typeof f.contentType === 'string' && f.contentType.length <= 100
            ? f.contentType
            : contentTypeFor(rel),
        size: f.size as number,
        chunks: f.chunks as number,
      })
    }
    const duration =
      b.durationS === undefined || b.durationS === null
        ? null
        : intIn(b.durationS, 0, 86399)
          ? (b.durationS as number)
          : null
    const now = Date.now()
    // Files first, playable row LAST: the unit turns on only if the whole
    // batch landed, and D1 runs a batch as one transaction.
    const statements = files.map((f) =>
      db
        .prepare(
          'INSERT INTO library_files (key, media, kind, content_type, size, chunks, added_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET kind = excluded.kind, content_type = excluded.content_type, size = excluded.size, chunks = excluded.chunks, added_at = excluded.added_at'
        )
        .bind(
          `${unit.prefix}/${f.path}`,
          unit.media,
          fileKindFor(f.path),
          f.contentType,
          f.size,
          f.chunks,
          now
        )
    )
    statements.push(
      db
        .prepare(
          'INSERT INTO library_media (media, title, status, duration_s, added_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(media) DO UPDATE SET title = excluded.title, status = excluded.status, duration_s = excluded.duration_s, added_at = excluded.added_at'
        )
        .bind(unit.media, unit.title, 'ready', duration, now)
    )
    await db.batch(statements)
    return json({ ok: true, media: unit.media, files: files.length }, 200)
  }

  if (request.method === 'DELETE' && pathname === '/api/library/ingest') {
    const unit = mediaOf(b.media)
    if (!unit) return json({ error: 'bad media' }, 400)
    const results = await db.batch([
      db
        .prepare('DELETE FROM library_blobs WHERE key LIKE ?')
        .bind(`${unit.prefix}/%`),
      db.prepare('DELETE FROM library_files WHERE media = ?').bind(unit.media),
      db.prepare('DELETE FROM library_media WHERE media = ?').bind(unit.media),
    ])
    return json(
      {
        ok: true,
        media: unit.media,
        removed: results.map((r) => Number(r.meta?.changes ?? 0)),
      },
      200
    )
  }

  return json({ error: 'not found' }, 404)
}
