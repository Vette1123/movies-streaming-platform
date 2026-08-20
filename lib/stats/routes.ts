/**
 * Runtimes for titles the library recorded before it started storing them.
 *
 * `buildWatchedItem` now writes the real runtime onto every row it creates, so
 * everything watched from today is exact. What this fixes is the back
 * catalogue: a library built over two years is thousands of rows with no
 * runtime on them, and the alternative to this endpoint is either an hours
 * figure that stays an estimate forever, or one TMDB request per title, which
 * is precisely the pattern that blew the 50-subrequests-per-invocation cap when
 * IMDb ratings tried it (see services/imdb.ts and the flag it is off behind).
 *
 * So: **zero TMDB traffic**. `watched_media.runtime` is already written by the
 * hourly alert sweep for every watchlisted title on the site, and it is written
 * there because the sweep has to fetch those payloads anyway to know when the
 * next episode airs. This is one indexed read over rows that exist for another
 * reason — the same trick `/api/upcoming` uses, and the reason migration 0003
 * added the column with nothing reading it yet.
 *
 * Coverage is therefore partial and honestly so: a title nobody has ever
 * watchlisted is not in that table, and those rows keep the average. The client
 * knows the difference (`exactRuntimes` vs `countedRuntimes`) and the panel
 * says "about" until they agree.
 */

import { loadSession, sessionCookieOf } from '@/lib/auth/session'
import { isEntitled } from '@/lib/billing/entitlement'

/**
 * Hard caps. A library of ten thousand rows must not become one query with ten
 * thousand placeholders — D1 has a variable limit and a request that hits it
 * fails as a 500 rather than as a slightly worse answer.
 */
const MAX_KEYS = 400
const MAX_KEY_LENGTH = 32
const MAX_BODY_BYTES = 32 * 1024

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Personal, and cheap to recompute. Nothing shared may hold it.
      'Cache-Control': 'private, no-store',
    },
  })

/**
 * Only `movie:123` / `series:123`, and only that.
 *
 * The values land in a SQL `IN (...)` as bound parameters, so this is not what
 * stands between the endpoint and injection — the binding is. It is what stops
 * a caller turning one request into an arbitrarily large query, which is the
 * cheaper attack and the more likely accident.
 */
export function normaliseRuntimeKeys(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  const seen = new Set<string>()

  for (const raw of input) {
    if (out.length >= MAX_KEYS) break
    if (typeof raw !== 'string' || raw.length > MAX_KEY_LENGTH) continue
    if (!/^(movie|series):\d+$/.test(raw)) continue
    if (seen.has(raw)) continue
    seen.add(raw)
    out.push(raw)
  }

  return out
}

/** POST /api/stats/runtimes — { keys: string[] } to { runtimes: {key: minutes} } */
export async function handleStatsRuntimes(
  request: Request,
  db: D1Database
): Promise<Response> {
  const now = Date.now()
  const user = await loadSession(db, sessionCookieOf(request), now)
  if (!user) return json({ success: false, error: 'Not signed in' }, 401)
  // Supporter-only for the same reason the rest of the synced library is: this
  // answers a question about a library that only exists on the server for
  // people who pay for it to.
  if (!isEntitled(user, now)) {
    return json({ success: false, error: 'Supporters only' }, 403)
  }

  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) {
    return json({ success: false, error: 'Too large' }, 413)
  }

  let body: { keys?: unknown }
  try {
    body = await request.json()
  } catch {
    return json({ success: false, error: 'Invalid request body' }, 400)
  }

  const keys = normaliseRuntimeKeys(body.keys)
  if (keys.length === 0) return json({ success: true, runtimes: {} })

  const rows = await db
    .prepare(
      `SELECT media_key, runtime FROM watched_media
       WHERE runtime IS NOT NULL
         AND media_key IN (${keys.map(() => '?').join(',')})`
    )
    .bind(...keys)
    .all<{ media_key: string; runtime: number }>()

  const runtimes: Record<string, number> = {}
  for (const row of rows.results ?? []) {
    if (row.runtime > 0) runtimes[row.media_key] = row.runtime
  }

  return json({ success: true, runtimes })
}
