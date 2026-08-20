/**
 * The synced library: watchlist, watch history, per-episode completion, and
 * resume points, kept the same on every device someone signs in on.
 *
 * The hard part of any sync is not the transport, it is what happens when two
 * devices disagree. The rule here is **last write wins, per item**, with
 * tombstones for deletes — which is the correct model for this data: every item
 * is independent, edits are rare, and the worst a wrong merge can do is put a
 * title back in a watchlist, not lose work.
 *
 * One endpoint does both directions. A separate pull would double the request
 * count against the 100k/day cap for no benefit, and the client always wants
 * both halves at once anyway.
 */

import { loadSession, sessionCookieOf } from '@/lib/auth/session'
import { isEntitled } from '@/lib/billing/entitlement'

/**
 * The stores, as an allowlist. `store` lands in a primary key, so an unbounded
 * value would let a client write unlimited distinct rows under one account —
 * the cheapest possible way to fill someone else's database.
 */
export const SYNC_STORES = [
  'watchlist',
  'history',
  'completed',
  'resume',
  // Your own score and note per title. Same row shape as the rest; see the
  // rating/note fields on WatchedItem.
  'reviews',
  // "Not interested" — titles to keep out of recommendations and rails.
  //
  // It rides the ordinary per-title sync rather than a table of its own, which
  // also means lib/foryou/routes.ts excludes it for free: readLibrary() adds
  // EVERY key from EVERY store to its exclusion set, so a hidden title stops
  // being recommended the moment it syncs, with no change there at all.
  'hidden',
]

/**
 * Bounds, all of them chosen so one request can never be expensive.
 *
 * The body cap is what keeps an unauthenticated-shaped mistake from costing CPU;
 * the change cap is what keeps a first sync of a huge library from arriving as
 * one enormous statement batch. A large library simply pages: the client sends
 * 500 at a time until it runs out.
 */
export const MAX_SYNC_BYTES = 256 * 1024
export const MAX_CHANGES = 500
/** Per pull. Far above any realistic delta between two visits. */
const MAX_PULL_ROWS = 2000
const MAX_KEY_LENGTH = 64
/** One item's JSON. A WatchedItem with a long overview is ~1 KB. */
const MAX_PAYLOAD_LENGTH = 4096

export interface SyncChange {
  store: string
  key: string
  /** The item's JSON, or null for a tombstone. */
  payload: string | null
  updated_at: number
}

/**
 * Validate and clamp one batch of incoming changes.
 *
 * Pure, and separated from the SQL for exactly that reason: this is where every
 * hostile or merely broken input is dealt with, and it is the part worth
 * testing exhaustively.
 *
 * `updated_at` is the CLIENT's clock. A device running three hours fast would
 * otherwise pin its version of every item as permanently newest — no later edit
 * from any other device could ever win. Clamping to server-now bounds that to
 * whatever skew exists within one request.
 */
export function normaliseChanges(input: unknown, now: number): SyncChange[] {
  if (!Array.isArray(input)) return []
  const out: SyncChange[] = []

  for (const raw of input.slice(0, MAX_CHANGES)) {
    if (!raw || typeof raw !== 'object') continue
    const change = raw as Record<string, unknown>

    const store = change.store
    const key = change.key
    if (typeof store !== 'string' || !SYNC_STORES.includes(store)) continue
    if (typeof key !== 'string' || !key || key.length > MAX_KEY_LENGTH) continue

    let payload: string | null = null
    if (change.payload !== null && change.payload !== undefined) {
      // Accept an object and serialise it here, so the client never has to
      // double-encode and the column always holds one shape.
      const encoded =
        typeof change.payload === 'string'
          ? change.payload
          : JSON.stringify(change.payload)
      if (typeof encoded !== 'string' || encoded.length > MAX_PAYLOAD_LENGTH) {
        continue
      }
      payload = encoded
    }

    const stamp = Number(change.updated_at)
    if (!Number.isFinite(stamp) || stamp <= 0) continue

    out.push({ store, key, payload, updated_at: Math.min(stamp, now) })
  }

  return out
}

/** The body, or null if it is over the cap. See hmac-webhook.ts for the shape. */
async function readJsonBounded(request: Request): Promise<unknown | null> {
  if (Number(request.headers.get('Content-Length')) > MAX_SYNC_BYTES)
    return null
  const text = await request.text()
  if (text.length > MAX_SYNC_BYTES) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  })

/**
 * POST /api/sync — push and pull in one round trip.
 *
 * Request:  { since: <epoch ms>, changes: [{ store, key, payload, updated_at }] }
 * Response: { now, changes: [...] }
 *
 * `now` is what the client stores as its next `since`. Taken once, before the
 * write, so an item written during this request is never skipped by the next
 * pull.
 */
export async function handleSync(
  request: Request,
  db: D1Database
): Promise<Response> {
  const now = Date.now()
  const user = await loadSession(db, sessionCookieOf(request), now)
  if (!user) return json({ success: false, error: 'Not signed in' }, 401)

  // Sync is what support buys. 402 rather than 403 so the client can tell
  // "you need to support this" apart from "you are not allowed", and show the
  // right card instead of an error.
  if (!isEntitled(user, now)) {
    return json(
      { success: false, error: 'Library sync is a supporter feature.' },
      402
    )
  }

  const body = await readJsonBounded(request)
  if (body === null) return json({ success: false, error: 'Bad request' }, 400)

  const input = body as { since?: unknown; changes?: unknown }
  const since = Number(input.since)
  const cursor = Number.isFinite(since) && since > 0 ? since : 0
  const changes = normaliseChanges(input.changes, now)

  if (changes.length > 0) {
    // One round trip regardless of how many items moved. The WHERE on the
    // conflict clause is the merge rule itself: an older write loses, so a
    // delayed request from a device that has been offline cannot undo newer
    // edits made since.
    const statement = db.prepare(
      `INSERT INTO sync_items (user_id, store, item_key, payload, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, store, item_key) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at
       WHERE excluded.updated_at >= sync_items.updated_at`
    )
    await db.batch(
      changes.map((change) =>
        statement.bind(
          user.id,
          change.store,
          change.key,
          change.payload,
          change.updated_at
        )
      )
    )
  }

  // Everything newer than the client's cursor, including tombstones — a delete
  // that only exists as an absent row would be resurrected by the next device
  // that still holds the item.
  const pulled = await db
    .prepare(
      `SELECT store, item_key, payload, updated_at
       FROM sync_items
       WHERE user_id = ? AND updated_at > ?
       ORDER BY updated_at ASC
       LIMIT ${MAX_PULL_ROWS}`
    )
    .bind(user.id, cursor)
    .all<{
      store: string
      item_key: string
      payload: string | null
      updated_at: number
    }>()

  const rows = pulled.results ?? []

  return json({
    success: true,
    now,
    // Truncated pulls are honest about it: the client immediately syncs again
    // from the last row's stamp rather than believing it is up to date.
    more: rows.length === MAX_PULL_ROWS,
    changes: rows.map((row) => ({
      store: row.store,
      key: row.item_key,
      payload: row.payload,
      updated_at: row.updated_at,
    })),
  })
}
