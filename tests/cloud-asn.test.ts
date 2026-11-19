import {
  cloudAsnExpr,
  isRefusedCloudRequest,
} from '@/scripts/lib/cloud-asn.mjs'
import { describe, expect, it } from 'vitest'

const AZURE = 8075
const AWS = 14618
const COMCAST = 7922

const refused = (asn: number, path: string, verifiedBot = false) =>
  isRefusedCloudRequest({ asn, path, verifiedBot })

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
    expect(expr).toContain('not cf.client.bot')
    expect(expr).toContain('"/movies/genre"')
    expect(expr).toContain('"/movies/550"')
  })
})
