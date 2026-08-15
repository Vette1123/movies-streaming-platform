/**
 * The two endpoints a push subscription needs, plus the queue the service worker
 * drains when a payloadless push wakes it.
 */

import { loadSession, sessionCookieOf } from '@/lib/auth/session'
import { isEntitled } from '@/lib/billing/entitlement'
import { sha256Hex } from '@/lib/token'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  })

const MAX_ENDPOINT = 1024
/** What the service worker shows at once. More than this is a notification storm. */
const MAX_PENDING = 5

/**
 * POST /api/push/subscribe
 *
 * `{ endpoint, keys: { p256dh, auth } }` to register, `{ endpoint,
 * unsubscribe: true }` to drop it. Both come straight from the browser's own
 * `PushSubscription.toJSON()`.
 */
export async function handlePushSubscribe(
  request: Request,
  db: D1Database
): Promise<Response> {
  const now = Date.now()
  const user = await loadSession(db, sessionCookieOf(request), now)
  if (!user) return json({ success: false, error: 'Not signed in' }, 401)
  if (!isEntitled(user, now)) {
    return json(
      { success: false, error: 'Alerts are a supporter feature.' },
      402
    )
  }

  let body: {
    endpoint?: unknown
    keys?: { p256dh?: unknown; auth?: unknown }
    unsubscribe?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return json({ success: false, error: 'Bad request' }, 400)
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
  // A push endpoint is always an https URL at the browser vendor's own service.
  // Anything else is either a mistake or an attempt to make this Worker POST at
  // a host of someone else's choosing, on a schedule, for free.
  if (
    !endpoint ||
    endpoint.length > MAX_ENDPOINT ||
    !endpoint.startsWith('https://')
  ) {
    return json({ success: false, error: 'Bad endpoint' }, 400)
  }

  // Keyed by the hash of the endpoint, so re-subscribing the same browser is an
  // upsert rather than a second row that gets pushed to twice.
  const id = await sha256Hex(endpoint)

  if (body.unsubscribe === true) {
    await db
      .prepare('DELETE FROM push_subs WHERE id = ? AND user_id = ?')
      .bind(id, user.id)
      .run()
    return json({ success: true })
  }

  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : ''
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth : ''
  // Stored but unused today — the push carries no payload, so nothing needs to
  // be encrypted to them. They are kept because they are the whole cost of ever
  // switching to payloads later, and re-collecting them would mean asking every
  // supporter to re-subscribe.
  if (!p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    return json({ success: false, error: 'Bad keys' }, 400)
  }

  await db
    .prepare(
      `INSERT INTO push_subs (id, user_id, endpoint, p256dh, auth, created_at, failed_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         failed_at = NULL`
    )
    .bind(id, user.id, endpoint, p256dh, auth, now)
    .run()

  return json({ success: true })
}

/**
 * GET /api/push/pending — what to show, and marking it shown in the same breath.
 *
 * Called by the service worker's `push` handler with `credentials: 'include'`,
 * which is why it authenticates with the session cookie rather than a token: a
 * service worker woken by a push has no access to the page's memory, and so no
 * access to an access token.
 */
export async function handlePushPending(
  request: Request,
  db: D1Database
): Promise<Response> {
  const now = Date.now()
  const user = await loadSession(db, sessionCookieOf(request), now)
  if (!user) return json({ success: false, error: 'Not signed in' }, 401)

  const rows = await db
    .prepare(
      `SELECT id, title, body, url FROM notifications
       WHERE user_id = ? AND read_at IS NULL
       ORDER BY created_at ASC LIMIT ${MAX_PENDING}`
    )
    .bind(user.id)
    .all<{ id: string; title: string; body: string; url: string }>()

  const pending = rows.results ?? []

  // Marked read as they are handed over, not when the user taps one: a
  // notification that was displayed and ignored must not be displayed again on
  // the next push. The row survives so `/account` can show a history.
  if (pending.length > 0) {
    const statement = db.prepare(
      'UPDATE notifications SET read_at = ? WHERE id = ?'
    )
    await db.batch(pending.map((row) => statement.bind(now, row.id)))
  }

  return json({ success: true, notifications: pending })
}
