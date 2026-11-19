import {
  challengeExpr,
  isChallenged,
  CHALLENGE_HOP_PATH as RULE_HOP_PATH,
} from '@/scripts/lib/challenge.mjs'
import { describe, expect, it } from 'vitest'

import {
  CHALLENGE_HOP_PATH,
  HOP_COOLDOWN_MS,
  hopUrl,
  isChallengedApi,
  mayHop,
  safeReturnPath,
} from '@/lib/challenge-hop'

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

describe('Managed Challenge coverage', () => {
  it('challenges a browser-looking scraper on Worker pages and public APIs', () => {
    for (const path of [
      '/movies/12345',
      '/tv-shows/999',
      '/collection/10',
      '/l/my-list',
      '/u/someone',
      '/api/media/movie/1',
      '/api/search',
      '/api/filter',
      '/api/popular',
      '/api/season-details',
      '/api/newsletter/subscribe',
      '/api/verify',
    ]) {
      expect(isChallenged({ path, verifiedBot: false, ua: CHROME })).toBe(true)
    }
  })

  it('never challenges search engines and AI crawlers', () => {
    for (const path of ['/movies/12345', '/api/media/movie/1']) {
      expect(isChallenged({ path, verifiedBot: true })).toBe(false)
    }
  })

  it('leaves static pages, assets, machine APIs, Kodi and the smoke page alone', () => {
    for (const path of [
      '/',
      '/movies',
      '/movies/genre/28',
      '/tv-shows/year/2019',
      '/movies/550',
      '/api/stream/health',
      '/api/pro/ticket',
      '/api/device',
      '/api/calendar/abc.ics',
      '/api/auth/callback',
      '/api/library/play',
    ]) {
      expect(isChallenged({ path, verifiedBot: false, ua: CHROME })).toBe(false)
    }
    expect(
      isChallenged({
        path: '/movies/12345/__next.segment.txt',
        verifiedBot: false,
        asset: true,
      })
    ).toBe(false)
    expect(
      isChallenged({
        path: '/api/media/movie/1',
        verifiedBot: false,
        ua: 'Reely-Kodi/1.4.0',
      })
    ).toBe(false)
  })

  it('the WAF expression carries the same exemptions', () => {
    const expr = challengeExpr({ assetExpr: 'ASSET', hostExempt: 'HOST' })
    expect(expr).toContain('not cf.client.bot')
    expect(expr).toContain('Reely-Kodi/')
    expect(expr).toContain('"/api/search"')
    expect(expr).toContain('not (ASSET)')
    expect(expr).toContain('and HOST')
  })

  it('the hop path is challenged, and both halves agree on it', () => {
    expect(RULE_HOP_PATH).toBe(CHALLENGE_HOP_PATH)
  })
})

describe('challenge hop', () => {
  const origin = 'https://www.reely.space'

  it('hops only for a challenged answer from our own API', () => {
    expect(isChallengedApi(403, 'challenge', '/api/search?q=x', origin)).toBe(
      true
    )
    expect(isChallengedApi(403, null, '/api/search', origin)).toBe(false)
    expect(isChallengedApi(200, 'challenge', '/api/search', origin)).toBe(false)
    expect(
      isChallengedApi(403, 'challenge', '/movies/1.txt?_rsc=1', origin)
    ).toBe(false)
    expect(
      isChallengedApi(403, 'challenge', 'https://evil.example/api/x', origin)
    ).toBe(false)
  })

  it('returns to the same page', () => {
    expect(
      hopUrl({ pathname: '/movies/genre/28', search: '?page=2', hash: '#x' })
    ).toBe('/api/verify?next=%2Fmovies%2Fgenre%2F28%3Fpage%3D2%23x')
  })

  it('refuses an open redirect', () => {
    expect(safeReturnPath('/tv-shows/1')).toBe('/tv-shows/1')
    expect(safeReturnPath('//evil.example')).toBe('/')
    expect(safeReturnPath('/\\evil.example')).toBe('/')
    expect(safeReturnPath('https://evil.example')).toBe('/')
    expect(safeReturnPath(null)).toBe('/')
  })

  it('cannot loop when the pass does not stick', () => {
    expect(mayHop(null, 1000)).toBe(true)
    expect(mayHop(1000, 1000 + HOP_COOLDOWN_MS)).toBe(false)
    expect(mayHop(1000, 1001 + HOP_COOLDOWN_MS)).toBe(true)
  })
})
