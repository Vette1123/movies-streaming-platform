/**
 * Which paths the account half owns, and with which method.
 *
 * Split out of account-router.ts so that cloudflare/worker.js can ask the
 * question without importing the answer. The router pulls in seventeen route
 * modules — auth, billing, sync, push, lists, profile, calendar — and every one
 * of them is evaluated when an isolate starts, on an entrypoint where 96% of
 * requests (measured: 12,518 of 13,027 over six hours) are tail-id page
 * fallbacks that will never call any of it. This table has no imports at all,
 * so the router can be loaded lazily behind it and cold isolates stop paying
 * for a half of the Worker they do not use.
 */
export const ROUTES: Record<string, 'GET' | 'POST' | 'GET|POST'> = {
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
  '/api/next-up': 'GET',
  '/api/for-you': 'GET',
  '/api/import/resolve': 'POST',
  '/api/stats/runtimes': 'POST',
  '/api/profile': 'GET|POST',
  '/api/gifts': 'GET|POST',
  '/api/community': 'GET',
}

export function ownsPath(pathname: string): boolean {
  // Cheapest possible first test: nothing here is reachable off /api/, and this
  // runs before every single request the Worker serves.
  if (!pathname.startsWith('/api/')) return false
  return (
    pathname in ROUTES ||
    pathname.startsWith('/api/list/') ||
    pathname.startsWith('/api/calendar/') ||
    pathname.startsWith('/api/profile/')
  )
}
