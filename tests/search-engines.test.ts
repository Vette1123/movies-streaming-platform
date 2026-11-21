import { generateKeyPairSync } from 'node:crypto'
import {
  googleJwt,
  sitemapFeeds,
  submitSitemaps,
} from '@/scripts/lib/search-engines.mjs'
import { describe, expect, it } from 'vitest'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const SA = JSON.stringify({
  client_email: 'bot@x.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
})
const ROOT = 'https://www.reely.space/sitemap.xml'
const INDEX = `<sitemapindex xmlns="x">
<sitemap><loc>https://www.reely.space/sitemaps/core.xml</loc></sitemap>
<sitemap><loc>https://www.reely.space/sitemaps/tv.xml</loc></sitemap>
</sitemapindex>`

type Call = { url: string; init?: RequestInit }
function fakeFetch(status: (url: string) => number) {
  const calls: Call[] = []
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.includes('oauth2'))
      return new Response(JSON.stringify({ access_token: 't' }))
    return new Response('nope', { status: status(url) })
  }
  return { calls, impl }
}
const target = {
  feeds: [ROOT],
  gscSite: 'sc-domain:reely.space',
  bingSite: 'https://reely.space',
}

describe('sitemapFeeds', () => {
  it('lists every child of an index, so none goes unread', () => {
    expect(sitemapFeeds(ROOT, INDEX)).toEqual([
      ROOT,
      'https://www.reely.space/sitemaps/core.xml',
      'https://www.reely.space/sitemaps/tv.xml',
    ])
  })
  it('a plain urlset (or nothing read) is the root alone', () => {
    expect(
      sitemapFeeds(ROOT, '<urlset><url><loc>https://a/</loc></url></urlset>')
    ).toEqual([ROOT])
    expect(sitemapFeeds(ROOT, null)).toEqual([ROOT])
  })
})

describe('googleJwt', () => {
  it('signs a webmasters-scoped RS256 assertion valid one hour', async () => {
    const [h, p, sig] = (await googleJwt(JSON.parse(SA), 1000)).split('.')
    expect(JSON.parse(atob(h))).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(
      JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')))
    ).toMatchObject({
      scope: 'https://www.googleapis.com/auth/webmasters',
      iat: 1000,
      exp: 4600,
    })
    expect(sig.length).toBeGreaterThan(300)
  })
})

describe('submitSitemaps', () => {
  it('PUTs each feed to GSC and POSTs each to Bing SubmitFeed', async () => {
    const f = fakeFetch(() => 200)
    const r = await submitSitemaps(
      { ...target, feeds: sitemapFeeds(ROOT, INDEX) },
      { GSC_SERVICE_ACCOUNT_JSON: SA, BING_API_KEY: 'k' },
      f.impl,
      () => {}
    )
    expect(r).toEqual({ gsc: 'ok', bing: 'ok' })
    const gsc = f.calls.filter((c) => c.url.includes('webmasters/v3'))
    expect(gsc.map((c) => c.init?.method)).toEqual(['PUT', 'PUT', 'PUT'])
    expect(gsc[2].url).toBe(
      'https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Areely.space/sitemaps/https%3A%2F%2Fwww.reely.space%2Fsitemaps%2Ftv.xml'
    )
    const bing = f.calls.filter((c) => c.url.includes('SubmitFeed'))
    expect(bing).toHaveLength(3)
    expect(JSON.parse(String(bing[0].init?.body))).toEqual({
      siteUrl: 'https://reely.space',
      feedUrl: ROOT,
    })
  })

  it('skips an engine whose secret is missing, without a request', async () => {
    const f = fakeFetch(() => 200)
    expect(await submitSitemaps(target, {}, f.impl, () => {})).toEqual({
      gsc: 'skipped',
      bing: 'skipped',
    })
    expect(f.calls).toHaveLength(0)
  })

  it('a rejected submit is reported and warned, never thrown', async () => {
    const f = fakeFetch((u) => (u.includes('SubmitFeed') ? 400 : 403))
    const lines: string[] = []
    const r = await submitSitemaps(
      target,
      { GSC_SERVICE_ACCOUNT_JSON: SA, BING_API_KEY: 'k' },
      f.impl,
      (l: string) => lines.push(l)
    )
    expect(r).toEqual({ gsc: 'failed', bing: 'failed' })
    expect(lines.filter((l) => l.startsWith('::warning::'))).toHaveLength(2)
  })

  it('a bad service-account secret fails GSC and still submits to Bing', async () => {
    const f = fakeFetch(() => 200)
    const r = await submitSitemaps(
      target,
      { GSC_SERVICE_ACCOUNT_JSON: '{not json', BING_API_KEY: 'k' },
      f.impl,
      () => {}
    )
    expect(r).toEqual({ gsc: 'failed', bing: 'ok' })
  })
})
