import {
  isCrawlerFire,
  isSpoofedCrawlerUserAgent,
  isWafRefusedPath,
} from '@/scripts/lib/crawler-403.mjs'
import { describe, expect, it } from 'vitest'

/**
 * The crawler check is the health check's only five-alarm fire, so it has to
 * be right in both directions: too loose and every real refusal of Googlebot
 * is buried; too tight and a permanent red check gets ignored, which is worse
 * than no check at all.
 *
 * These are the two 403s that are the site working, not the site broken.
 */

const GOOGLEBOT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const APPLEBOT = 'Mozilla/5.0 (Applebot/0.1; +http://www.apple.com/go/applebot)'
const BINGBOT =
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'
const DUCKDUCKBOT = 'DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)'

// The exact User-Agent the /.env probes arrived with on 2026-10-20: a real
// mobile Chrome, with Googlebot's name bolted on the end.
const SPOOFED_GOOGLEBOT =
  'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
const SPOOFED_APPLEBOT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)'

describe('isWafRefusedPath', () => {
  it('knows the paths the WAF refuses on purpose', () => {
    expect(isWafRefusedPath('/.env')).toBe(true)
    expect(isWafRefusedPath('/private/.env')).toBe(true)
    expect(isWafRefusedPath('/wp-login.php')).toBe(true)
    expect(isWafRefusedPath('/config/settings.ini')).toBe(false)
    expect(isWafRefusedPath('/movies/550')).toBe(false)
  })
})

describe('isSpoofedCrawlerUserAgent', () => {
  it('does not call a real crawler a spoofer', () => {
    for (const ua of [GOOGLEBOT, APPLEBOT, BINGBOT, DUCKDUCKBOT]) {
      expect(isSpoofedCrawlerUserAgent(ua)).toBe(false)
    }
  })

  it('calls a browser wearing a crawler name a spoofer', () => {
    expect(isSpoofedCrawlerUserAgent(SPOOFED_GOOGLEBOT)).toBe(true)
    expect(isSpoofedCrawlerUserAgent(SPOOFED_APPLEBOT)).toBe(true)
  })
})

describe('isCrawlerFire', () => {
  it('counts a 403 on a real page for a real crawler', () => {
    expect(
      isCrawlerFire({
        userAgent: GOOGLEBOT,
        path: '/movies/550',
        status: 403,
      })
    ).toBe(true)
  })

  it('does not count the WAF refusing a probe path', () => {
    expect(
      isCrawlerFire({
        userAgent: SPOOFED_GOOGLEBOT,
        path: '/.env',
        status: 403,
      })
    ).toBe(false)
  })

  it('does not count a scraper wearing a crawler name', () => {
    expect(
      isCrawlerFire({
        userAgent: SPOOFED_GOOGLEBOT,
        path: '/movies/550',
        status: 403,
      })
    ).toBe(false)
  })

  it('always counts a 5xx — the site itself failed', () => {
    expect(
      isCrawlerFire({
        userAgent: GOOGLEBOT,
        path: '/movies/550',
        status: 500,
      })
    ).toBe(true)
    expect(
      isCrawlerFire({
        userAgent: SPOOFED_GOOGLEBOT,
        path: '/.env',
        status: 503,
      })
    ).toBe(true)
  })

  it('does not count a 404 — the correct answer to a dead URL', () => {
    expect(
      isCrawlerFire({
        userAgent: GOOGLEBOT,
        path: '/movies/999999999',
        status: 404,
      })
    ).toBe(false)
  })
})
