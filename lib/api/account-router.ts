/**
 * Everything an account can ask the Worker to do, in one dispatcher.
 *
 * Kept out of cloudflare/worker.js so that file stays what it is — the TMDB and
 * fallback Worker — and so this half can be read, and reasoned about, on its
 * own. It returns `null` for a path it does not own, which is what lets the
 * caller fall through to the existing routes without a second table.
 *
 * Nothing in here is reachable from a page view, from `/api/search` and its
 * siblings, or from the tail-id fallback: those paths never call this function.
 */

import {
  handleAccount,
  handleAuthCallback,
  handleAuthStart,
  handleLogout,
  handleRefresh,
} from '@/lib/auth/routes'
import { handleBmcWebhook } from '@/lib/billing/bmc'
import { handleLists, loadPublicList } from '@/lib/lists/routes'
import { handlePushPending, handlePushSubscribe } from '@/lib/push/routes'
import { handleSync } from '@/lib/sync/routes'
import { handleCalendarFeed, handleUpcoming } from '@/lib/upcoming/routes'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  })

/**
 * The database, or the response to send instead.
 *
 * A deployment without the binding answers 503 rather than throwing: the rest of
 * the site works perfectly without a database, and it must keep working if this
 * half is misconfigured. The client treats 503 as "unanswerable", not as "signed
 * out", so nobody is logged out by a bad deploy.
 */
function requireDb(env: WorkerEnv): D1Database | Response {
  const db = env.DB
  if (!db) {
    return json(
      { success: false, error: 'Accounts are not configured here.' },
      503
    )
  }
  return db
}

const methodNotAllowed = () =>
  json({ success: false, error: 'Method not allowed' }, 405)

/** Which method each path takes. Anything else is a 405 rather than a 404. */
const ROUTES: Record<string, 'GET' | 'POST' | 'GET|POST'> = {
  '/api/auth/google': 'GET',
  '/api/auth/callback': 'GET',
  '/api/auth/refresh': 'POST',
  '/api/auth/logout': 'POST',
  '/api/account': 'POST',
  '/api/billing/bmc': 'POST',
  '/api/sync': 'POST',
  '/api/lists': 'GET|POST',
  '/api/push/subscribe': 'POST',
  '/api/push/pending': 'GET',
  '/api/upcoming': 'GET|POST',
}

export function ownsPath(pathname: string): boolean {
  return (
    pathname in ROUTES ||
    pathname.startsWith('/api/list/') ||
    pathname.startsWith('/api/calendar/')
  )
}

/**
 * Dispatch, or `null` if this is not one of ours.
 *
 * `ctx` is accepted and currently unused: no handler here defers work past its
 * response. It is in the signature because the first one that needs to (a
 * reconcile, an analytics ping) should not have to change every call site.
 */
export async function routeAccountApi(
  pathname: string,
  request: Request,
  env: WorkerEnv,
  ctx: WaitUntilContext
): Promise<Response | null> {
  void ctx

  // The calendar feed carries its own credential in the URL, because the thing
  // polling it is Google Calendar or Apple Calendar — no cookies, no session, no
  // way to sign in. Handled before the method table for the same reason as the
  // public list below: it is a prefix, not a fixed path.
  if (pathname.startsWith('/api/calendar/')) {
    if (request.method !== 'GET') return methodNotAllowed()
    const db = requireDb(env)
    if (db instanceof Response) return db
    return handleCalendarFeed(pathname, db)
  }

  // The public list read is the one path here a stranger can reach, and the only
  // one that is cacheable. Handled first so it never pays for the method table.
  if (pathname.startsWith('/api/list/')) {
    if (request.method !== 'GET') return methodNotAllowed()
    const slug = decodeURIComponent(pathname.slice('/api/list/'.length))
    if (!slug) return json({ success: false, error: 'Not found' }, 404)

    const db = requireDb(env)
    if (db instanceof Response) return db

    const list = await loadPublicList(db, slug)
    if (!list) return json({ success: false, error: 'Not found' }, 404)
    return new Response(JSON.stringify({ success: true, list }), {
      headers: {
        'Content-Type': 'application/json',
        // Short, because unpublishing has to take effect quickly, and a
        // published list is not sensitive. Long enough that a link doing the
        // rounds in a group chat is answered from cache.
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    })
  }

  const allowed = ROUTES[pathname]
  if (!allowed) return null
  if (!allowed.split('|').includes(request.method)) return methodNotAllowed()

  const db = requireDb(env)
  if (db instanceof Response) return db

  switch (pathname) {
    case '/api/auth/google':
      return handleAuthStart(request)
    case '/api/auth/callback':
      return handleAuthCallback(request, db)
    case '/api/auth/refresh':
      return handleRefresh(request, db)
    case '/api/auth/logout':
      return handleLogout(request, db)
    case '/api/account':
      return handleAccount(request, db)
    case '/api/billing/bmc':
      return handleBmcWebhook(request, db)
    case '/api/sync':
      return handleSync(request, db)
    case '/api/lists':
      return handleLists(request, db)
    case '/api/push/subscribe':
      return handlePushSubscribe(request, db)
    case '/api/push/pending':
      return handlePushPending(request, db)
    case '/api/upcoming':
      return handleUpcoming(request, db)
    default:
      return null
  }
}
