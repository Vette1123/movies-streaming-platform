/**
 * Lists: named collections of titles, with an optional note and a personal
 * rating on each, and a public URL when their owner wants one.
 *
 * A list is stored as one row with its items as JSON rather than as a join
 * table. It is always read and written whole — the editor reorders rows, the
 * public page prints all of them — so rows would buy ordering complexity and N
 * writes per drag for a payload that is a few KB at any size anyone builds.
 */

import { loadSession, sessionCookieOf } from '@/lib/auth/session'
import { isEntitled } from '@/lib/billing/entitlement'
import { cleanQuery } from '@/lib/filter-presets'

const MAX_BODY_BYTES = 128 * 1024
const MAX_LISTS = 200
const MAX_ITEMS = 500
const MAX_NAME = 80
const MAX_DESCRIPTION = 400
const MAX_NOTE = 500

export interface ListItem {
  id: number
  type: 'movie' | 'series'
  title: string
  poster_path: string | null
  note?: string
  rating?: number
}

export interface StoredList {
  id: string
  name: string
  description: string | null
  /**
   * A smart list: the browse query its contents come from, instead of a fixed
   * set of them. NULL on an ordinary list, which is every list that existed
   * before this column did.
   *
   * The titles are resolved wherever the list is rendered — the panel and the
   * public page both run it through /api/filter, which is the same cached
   * discover call the browse pages make. Nothing is stored, so the list is as
   * current as the browse page it came from and cannot go stale.
   */
  smart_query: string | null
  /** Minted on the first publish and kept for good. See migration 0001. */
  slug: string | null
  published: boolean
  items: ListItem[]
  created_at: number
  updated_at: number
}

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

/**
 * One item, validated field by field.
 *
 * Everything here is rendered into a public page when the list is published, so
 * nothing arrives by being copied wholesale off the request. `poster_path` is
 * checked against TMDB's shape rather than accepted as a string, because it is
 * concatenated into an image URL.
 */
export function normaliseItem(value: unknown): ListItem | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Record<string, unknown>

  const id = Number(input.id)
  if (!Number.isInteger(id) || id <= 0) return null

  const type = input.type === 'series' ? 'series' : 'movie'
  const title = text(input.title, 200)
  if (!title) return null

  const poster =
    typeof input.poster_path === 'string' &&
    /^\/[\w.-]{1,60}$/.test(input.poster_path)
      ? input.poster_path
      : null

  const item: ListItem = { id, type, title, poster_path: poster }

  const note = text(input.note, MAX_NOTE)
  if (note) item.note = note

  const rating = Number(input.rating)
  if (Number.isFinite(rating) && rating >= 1 && rating <= 10) {
    // One decimal place, so a slider at 7.5 survives and 7.4999999 does not
    // become a different value on every save.
    item.rating = Math.round(rating * 10) / 10
  }

  return item
}

export function normaliseItems(value: unknown): ListItem[] {
  if (!Array.isArray(value)) return []
  const out: ListItem[] = []
  const seen = new Set<string>()
  for (const raw of value.slice(0, MAX_ITEMS)) {
    const item = normaliseItem(raw)
    if (!item) continue
    // A title can be in a list once. Two copies would render twice and make
    // "remove" ambiguous in the editor.
    const key = `${item.type}:${item.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

/**
 * A URL-safe slug from the list's name, plus enough randomness that two lists
 * called "Weekend" do not collide and that nobody can enumerate other people's
 * lists by guessing names.
 */
export function slugify(name: string, random: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    // Strip combining marks, so "Café" becomes "cafe" rather than "caf".
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${base || 'list'}-${random}`
}

const randomSuffix = () =>
  // 6 chars of base36 from real randomness: ~2 billion values, which is plenty
  // when it only has to avoid collisions inside one account's lists.
  Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((byte) => byte.toString(36))
    .join('')
    .slice(0, 6)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  })

const parseRow = (row: {
  id: string
  name: string
  description: string | null
  slug: string | null
  published: number
  items: string
  smart_query: string | null
  created_at: number
  updated_at: number
}): StoredList => ({
  id: row.id,
  name: row.name,
  description: row.description,
  smart_query: row.smart_query,
  // A slug on an unpublished list is history, not a live URL. Reporting it as
  // null keeps the client from offering a link that 404s.
  slug: row.published ? row.slug : null,
  published: row.published === 1,
  items: safeItems(row.items),
  created_at: row.created_at,
  updated_at: row.updated_at,
})

/** A row written by an older shape, or by hand, must not 500 the page. */
function safeItems(raw: string): ListItem[] {
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ListItem[]) : []
  } catch {
    return []
  }
}

async function readBody(
  request: Request
): Promise<Record<string, unknown> | null> {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES)
    return null
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null
    return body as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * GET  /api/lists        — everything this account owns
 * POST /api/lists        — { action: 'save' | 'delete' | 'publish' | 'unpublish', … }
 *
 * One endpoint with an action rather than five routes: they share the whole
 * preamble (session, entitlement, ownership), and splitting them would mean
 * writing that four more times.
 */
export async function handleLists(
  request: Request,
  db: D1Database
): Promise<Response> {
  const now = Date.now()
  const user = await loadSession(db, sessionCookieOf(request), now)
  if (!user) return json({ success: false, error: 'Not signed in' }, 401)
  if (!isEntitled(user, now)) {
    return json(
      { success: false, error: 'Lists are a supporter feature.' },
      402
    )
  }

  if (request.method === 'GET') {
    const rows = await db
      .prepare(
        `SELECT id, name, description, slug, published, items, smart_query,
                created_at, updated_at
         FROM lists WHERE user_id = ? ORDER BY updated_at DESC LIMIT ${MAX_LISTS}`
      )
      .bind(user.id)
      .all<Parameters<typeof parseRow>[0]>()
    return json({ success: true, lists: (rows.results ?? []).map(parseRow) })
  }

  const body = await readBody(request)
  if (!body) return json({ success: false, error: 'Bad request' }, 400)

  const action = body.action
  const id = typeof body.id === 'string' ? body.id : null

  if (action === 'delete') {
    if (!id) return json({ success: false, error: 'Missing id' }, 400)
    // The user_id in the WHERE is the ownership check: a list belonging to
    // somebody else matches zero rows rather than being deleted.
    await db
      .prepare('DELETE FROM lists WHERE id = ? AND user_id = ?')
      .bind(id, user.id)
      .run()
    return json({ success: true })
  }

  if (action === 'publish' || action === 'unpublish') {
    if (!id) return json({ success: false, error: 'Missing id' }, 400)
    const row = await db
      .prepare('SELECT id, name, slug FROM lists WHERE id = ? AND user_id = ?')
      .bind(id, user.id)
      .first<{ id: string; name: string; slug: string | null }>()
    if (!row) return json({ success: false, error: 'No such list' }, 404)

    if (action === 'unpublish') {
      // The slug is kept, deliberately. Nulling it frees the URL for the next
      // list to claim and hands this one a different address when it comes
      // back, which breaks every link already shared.
      await db
        .prepare('UPDATE lists SET published = 0, updated_at = ? WHERE id = ?')
        .bind(now, id)
        .run()
      return json({ success: true, slug: null })
    }

    // Re-publishing reuses the slug it was given the first time, so a link
    // already out in the world keeps working after a toggle.
    const slug = row.slug ?? slugify(row.name, randomSuffix())
    await db
      .prepare(
        'UPDATE lists SET slug = ?, published = 1, updated_at = ? WHERE id = ?'
      )
      .bind(slug, now, id)
      .run()
    return json({ success: true, slug })
  }

  if (action !== 'save') {
    return json({ success: false, error: 'Unknown action' }, 400)
  }

  const name = text(body.name, MAX_NAME)
  if (!name) return json({ success: false, error: 'A list needs a name' }, 400)
  const description = text(body.description, MAX_DESCRIPTION)
  const items = normaliseItems(body.items)
  // Round-tripped through URLSearchParams by the same helper the saved filters
  // use, so what is stored is a query string this site could have produced and
  // nothing else — it ends up in a URL the browser navigates to.
  const smart = cleanQuery(body.smart_query)

  if (id) {
    const result = await db
      .prepare(
        `UPDATE lists SET name = ?, description = ?, items = ?, smart_query = ?,
                          updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .bind(name, description, JSON.stringify(items), smart, now, id, user.id)
      .run()
    // A save for an id this account does not own writes nothing and says so,
    // rather than silently reporting success.
    const changed = Number(
      (result.meta as { changes?: number } | undefined)?.changes ?? 1
    )
    if (changed === 0)
      return json({ success: false, error: 'No such list' }, 404)
    return json({ success: true, id })
  }

  const count = await db
    .prepare('SELECT COUNT(*) AS n FROM lists WHERE user_id = ?')
    .bind(user.id)
    .first<{ n: number }>()
  if ((count?.n ?? 0) >= MAX_LISTS) {
    return json(
      { success: false, error: `A maximum of ${MAX_LISTS} lists.` },
      409
    )
  }

  const newId = crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO lists (id, user_id, name, description, slug, items, smart_query,
                          created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)`
    )
    .bind(
      newId,
      user.id,
      name,
      description,
      JSON.stringify(items),
      smart,
      now,
      now
    )
    .run()

  return json({ success: true, id: newId })
}

export interface PublicList {
  name: string
  description: string | null
  owner: string | null
  /** See StoredList.smart_query — the public page resolves it the same way. */
  smart_query: string | null
  /** Whether the owner's support is live right now — drives the badge. */
  owner_pro: boolean
  items: ListItem[]
  updated_at: number
}

/**
 * A published list, by slug, or null.
 *
 * Shared by the JSON endpoint and by the Worker's HTML renderer for `/l/<slug>`,
 * so the page and the data behind it can never disagree about what is published.
 * The owner's display name is included and their email is not: this is a page
 * strangers can open.
 */
export async function loadPublicList(
  db: D1Database,
  slug: string,
  now: number = Date.now()
): Promise<PublicList | null> {
  const row = await db
    .prepare(
      `SELECT lists.name, lists.description, lists.items, lists.smart_query,
              lists.updated_at, users.name AS owner, users.grants,
              users.sub_status, users.sub_ends_at, users.sub_past_due_since
       FROM lists JOIN users ON users.id = lists.user_id
       WHERE lists.slug = ? AND lists.published = 1`
    )
    .bind(slug)
    .first<{
      name: string
      description: string | null
      items: string
      smart_query: string | null
      updated_at: number
      owner: string | null
      grants: string | null
      sub_status: string | null
      sub_ends_at: number | null
      sub_past_due_since: number | null
    }>()

  if (!row) return null
  return {
    name: row.name,
    description: row.description,
    owner: row.owner,
    smart_query: row.smart_query,
    // The list stays up if support lapses — taking somebody's shared link down
    // over a missed payment would be a punishment, not a paywall. The badge is
    // what goes away.
    owner_pro: isEntitled(row, now),
    items: safeItems(row.items),
    updated_at: row.updated_at,
  }
}
