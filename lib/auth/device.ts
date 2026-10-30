/**
 * Device sign-in: how a TV gets a session without a browser on it.
 *
 * Google OAuth and an httpOnly cookie both assume a browser, and Kodi on a Fire
 * TV has neither. So the TV asks for a short code, shows it, and polls; a
 * signed-in supporter enters the code at /link on their phone; the next poll
 * collects an ordinary row in `sessions`, sent as a bearer token instead of a
 * cookie. Sharing that table is the point: the 90-day expiry, the five-session
 * cap and "sign out everywhere" all apply to a TV with no extra code.
 *
 * ponytail: /api/device/start is unauthenticated and writes one row. A flood
 * costs D1 writes (100k/day free), and rows clear themselves in ten minutes.
 * Add a WAF rate limit on this path if `pnpm cf:cpu` ever shows one.
 */

import { isEntitled } from '@/lib/billing/entitlement'
import { sha256Hex } from '@/lib/token'

import {
  formatUserCode,
  mintUserCode,
  normaliseUserCode,
  USER_CODE_LENGTH,
} from './device-code'
import { createSession, loadSession, sessionCookieOf } from './session'

export const DEVICE_LINK_TTL_MS = 10 * 60 * 1000
export const DEVICE_POLL_INTERVAL_S = 5

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, no-store',
    },
  })

async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' ? body : {}
  } catch {
    return {}
  }
}

/** POST /api/device/start: the TV asks for a code to show. */
export async function handleDeviceStart(
  request: Request,
  db: D1Database
): Promise<Response> {
  const now = Date.now()
  await db
    .prepare('DELETE FROM device_links WHERE expires_at <= ?')
    .bind(now)
    .run()

  const userCode = mintUserCode(
    crypto.getRandomValues(new Uint8Array(USER_CODE_LENGTH))
  )
  const deviceCode = crypto.randomUUID() + crypto.randomUUID()
  await db
    .prepare(
      'INSERT INTO device_links (user_code, device_hash, created_at, expires_at) VALUES (?, ?, ?, ?)'
    )
    .bind(userCode, await sha256Hex(deviceCode), now, now + DEVICE_LINK_TTL_MS)
    .run()

  return json({
    success: true,
    deviceCode,
    userCode: formatUserCode(userCode),
    verifyUrl: `${new URL(request.url).host.replace(/^www\./, '')}/link`,
    expiresIn: DEVICE_LINK_TTL_MS / 1000,
    interval: DEVICE_POLL_INTERVAL_S,
  })
}

/**
 * POST /api/device/poll: the TV asks whether its code has been approved.
 *
 * Collecting is one DELETE ... RETURNING, so two polls racing each other cannot
 * both walk away with a session.
 */
export async function handleDevicePoll(
  request: Request,
  db: D1Database
): Promise<Response> {
  const { deviceCode } = await bodyOf(request)
  if (typeof deviceCode !== 'string' || deviceCode.length > 128) {
    return json({ success: false, error: 'Bad request' }, 400)
  }
  const now = Date.now()
  const hash = await sha256Hex(deviceCode)

  const collected = await db
    .prepare(
      `DELETE FROM device_links
       WHERE device_hash = ? AND user_id IS NOT NULL AND expires_at > ?
       RETURNING user_id`
    )
    .bind(hash, now)
    .first<{ user_id: string }>()
  if (collected) {
    const token = await createSession(db, collected.user_id, now)
    return json({ success: true, status: 'approved', token })
  }

  const waiting = await db
    .prepare(
      'SELECT 1 FROM device_links WHERE device_hash = ? AND expires_at > ?'
    )
    .bind(hash, now)
    .first()
  if (waiting) return json({ success: true, status: 'pending' })
  return json({ success: false, status: 'expired' }, 410)
}

/**
 * POST /api/device/approve: a supporter claims a code from /link.
 *
 * Refused up front for anyone not entitled, so a free account is told why here
 * rather than linking a TV that then cannot play anything.
 */
export async function handleDeviceApprove(
  request: Request,
  db: D1Database
): Promise<Response> {
  const now = Date.now()
  const user = await loadSession(db, sessionCookieOf(request), now)
  if (!user) return json({ success: false, error: 'Not signed in' }, 401)
  if (!isEntitled(user, now)) {
    return json(
      { success: false, error: 'Linking a TV is a supporter feature.' },
      402
    )
  }

  const { code } = await bodyOf(request)
  const userCode = normaliseUserCode(code)
  if (!userCode) {
    return json({ success: false, error: 'That code is not valid.' }, 400)
  }

  const claimed = await db
    .prepare(
      'UPDATE device_links SET user_id = ? WHERE user_code = ? AND user_id IS NULL AND expires_at > ?'
    )
    .bind(user.id, userCode, now)
    .run()
  if (!claimed.meta.changes) {
    return json(
      {
        success: false,
        error: 'That code has expired. Get a new one on your TV.',
      },
      404
    )
  }
  return json({ success: true })
}
