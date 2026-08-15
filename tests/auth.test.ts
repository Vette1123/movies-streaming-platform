import { describe, expect, it } from 'vitest'

import { HINT_COOKIE, SESSION_COOKIE } from '@/lib/auth/cookies'
import { safeRedirect } from '@/lib/auth/google'
import {
  clearCookieHeaders,
  readCookie,
  sessionCookieHeaders,
  sessionsToEvict,
} from '@/lib/auth/session'
import {
  ACCESS_TOKEN_TTL_MS,
  base64UrlDecode,
  base64UrlEncode,
  signToken,
  verifyToken,
} from '@/lib/token'

const SECRET = 'a-session-signing-secret-long-enough'
const NOW = Date.parse('2026-08-15T12:00:00Z')

describe('safeRedirect', () => {
  const origin = 'https://www.reely.space'

  it('keeps a path on our own origin', () => {
    expect(safeRedirect('/account', origin)).toBe('/account')
    expect(safeRedirect('/account?tab=lists', origin)).toBe(
      '/account?tab=lists'
    )
    expect(safeRedirect(`${origin}/stats`, origin)).toBe('/stats')
  })

  it('refuses another origin', () => {
    expect(safeRedirect('https://evil.example/', origin)).toBe('/')
    expect(safeRedirect('//evil.example', origin)).toBe('/')
  })

  it('refuses the protocol-relative form that survives a pathname check', () => {
    // `/..//evil.example` has a pathname of `//evil.example` on OUR origin, so
    // an origin check alone passes it — and then it reads as protocol-relative
    // again the moment it is used as a bare Location.
    expect(safeRedirect('/..//evil.example', origin)).toBe('/evil.example')
    // A run of leading slashes parses as an authority outright, so the origin
    // check alone already catches this one.
    expect(safeRedirect('/////evil.example', origin)).toBe('/')
  })

  it('falls back to the homepage on nonsense', () => {
    expect(safeRedirect(null, origin)).toBe('/')
    expect(safeRedirect('', origin)).toBe('/')
  })
})

describe('sessionsToEvict', () => {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `s${i}` }))

  it('evicts nothing while there is room for one more', () => {
    expect(sessionsToEvict(rows(0), 5)).toEqual([])
    expect(sessionsToEvict(rows(4), 5)).toEqual([])
  })

  it('evicts the oldest to make room at the cap', () => {
    expect(sessionsToEvict(rows(5), 5)).toEqual(['s0'])
    expect(sessionsToEvict(rows(7), 5)).toEqual(['s0', 's1', 's2'])
  })
})

describe('cookies', () => {
  it('reads a name exactly, not by substring', () => {
    const header = `not_${SESSION_COOKIE}=wrong; ${SESSION_COOKIE}=right; other=x`
    expect(readCookie(header, SESSION_COOKIE)).toBe('right')
    expect(readCookie(null, SESSION_COOKIE)).toBeNull()
    expect(readCookie('malformed', SESSION_COOKIE)).toBeNull()
  })

  it('sets the session HttpOnly and the hint readable', () => {
    const [session, hint] = sessionCookieHeaders(
      'abc',
      100,
      'https://a.example'
    )
    expect(session).toContain(`${SESSION_COOKIE}=abc`)
    expect(session).toContain('HttpOnly')
    expect(session).toContain('Secure')
    expect(session).toContain('SameSite=Lax')
    expect(hint).toContain(`${HINT_COOKIE}=1`)
    expect(hint).not.toContain('HttpOnly')
  })

  it('drops Secure on http, which is the only way wrangler dev can sign in', () => {
    const [session] = sessionCookieHeaders('abc', 100, 'http://localhost:8788')
    expect(session).not.toContain('Secure')
  })

  it('clears both cookies with an immediate expiry', () => {
    const [session, hint] = clearCookieHeaders('https://a.example')
    expect(session).toContain(`${SESSION_COOKIE}=;`)
    expect(session).toContain('Max-Age=0')
    expect(hint).toContain(`${HINT_COOKIE}=;`)
  })
})

describe('access token', () => {
  const live = (over: Record<string, unknown> = {}) => ({
    u: 'user-1',
    exp: NOW + ACCESS_TOKEN_TTL_MS,
    p: true,
    ...over,
  })

  it('round-trips a payload', async () => {
    const token = await signToken(live(), SECRET)
    const payload = await verifyToken(token, SECRET, NOW)
    expect(payload?.u).toBe('user-1')
    expect(payload?.p).toBe(true)
  })

  it('refuses a token signed with another secret', async () => {
    const token = await signToken(live(), SECRET)
    expect(await verifyToken(token, 'another-secret', NOW)).toBeNull()
  })

  it('refuses a tampered payload', async () => {
    const token = await signToken(live({ p: false }), SECRET)
    const [body, signature] = token.split('.')
    const decoded = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(body))
    ) as Record<string, unknown>
    decoded.p = true
    const forged = `${base64UrlEncode(
      new TextEncoder().encode(JSON.stringify(decoded))
    )}.${signature}`
    expect(await verifyToken(forged, SECRET, NOW)).toBeNull()
  })

  it('expires, and refuses an expiry further out than one TTL', async () => {
    const token = await signToken(live(), SECRET)
    expect(
      await verifyToken(token, SECRET, NOW + ACCESS_TOKEN_TTL_MS + 1)
    ).toBeNull()
    // A token that claims a longer life than the TTL cannot buy itself one,
    // whatever `exp` the signer put in it.
    const overlong = await signToken(
      live({ exp: NOW + 10 * ACCESS_TOKEN_TTL_MS }),
      SECRET
    )
    expect(await verifyToken(overlong, SECRET, NOW)).toBeNull()
  })

  it('refuses anything that is not a token', async () => {
    expect(await verifyToken(null, SECRET, NOW)).toBeNull()
    expect(await verifyToken('', SECRET, NOW)).toBeNull()
    expect(await verifyToken('a.b.c', SECRET, NOW)).toBeNull()
    expect(await verifyToken('x'.repeat(1000), SECRET, NOW)).toBeNull()
  })
})
