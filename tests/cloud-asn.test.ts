import {
  cloudAsnExpr,
  isRefusedCloudRequest,
  trustedBotExpr,
} from '@/scripts/lib/cloud-asn.mjs'
import { describe, expect, it } from 'vitest'

const AZURE = 8075
const AWS = 14618
const COMCAST = 7922

const GPTBOT =
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.3; +https://openai.com/gptbot)'
// The 2026-11-20 fleet: Cloudflare-verified, Azure and AWS, a version string no
// real Chrome sends.
const FLEET_131 =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

const refused = (asn: number, path: string, verifiedBot = false, ua = GPTBOT) =>
  isRefusedCloudRequest({ asn, path, verifiedBot, ua })

describe('cloud ASN block', () => {
  it('refuses the 2026-11-19 fleet on the paths that bill the Worker', () => {
    for (const path of [
      '/movies/12345',
      '/tv-shows/999',
      '/api/media/movie/1',
      '/collection/10',
    ]) {
      expect(refused(AZURE, path)).toBe(true)
      expect(refused(AWS, path)).toBe(true)
    }
  })

  it('keeps search engines and AI crawlers (verified bots on cloud networks)', () => {
    expect(refused(AZURE, '/movies/12345', true)).toBe(false)
  })

  it('refuses a verified bot on a cloud network that will not name itself', () => {
    expect(refused(AZURE, '/movies/12345', true, FLEET_131)).toBe(true)
    expect(refused(AWS, '/api/media/movie/1', true, FLEET_131)).toBe(true)
    expect(refused(COMCAST, '/movies/12345', true, FLEET_131)).toBe(false)
  })

  it('the allowlist stops skipping the ruleset for that bot', () => {
    const expr = trustedBotExpr()
    expect(expr).toMatch(
      /^\(cf\.client\.bot and not \(\(ip\.src\.asnum in \{8075 /
    )
    expect(expr).toContain('(http.user_agent contains "compatible")')
  })

  it('keeps people, static hubs, the home page and the deploy smoke test', () => {
    expect(refused(COMCAST, '/movies/12345')).toBe(false)
    for (const path of [
      '/',
      '/movies',
      '/movies/genre/28',
      '/tv-shows/year/2019',
      '/movies/550',
    ]) {
      expect(refused(AZURE, path)).toBe(false)
    }
  })

  it('the WAF expression carries the same exemptions', () => {
    const expr = cloudAsnExpr()
    expect(expr).toContain('ip.src.asnum in {8075 ')
    expect(expr).toContain(
      'not (cf.client.bot and ((http.user_agent contains "bot")'
    )
    expect(expr).toContain('"/movies/genre"')
    expect(expr).toContain('"/movies/550"')
  })
})
