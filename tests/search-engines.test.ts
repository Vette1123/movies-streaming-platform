import {
  bingSummary,
  googleJwt,
  gscSitemapProblems,
  sitemapFeeds,
  submitSitemaps,
} from '@/scripts/lib/search-engines.mjs'
import { generateKeyPairSync } from 'node:crypto'
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
function fakeFetch(
  status: (url: string) => number,
  body: (url: string) => string = () => 'nope'
) {
  const calls: Call[] = []
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.includes('oauth2'))
      return new Response(JSON.stringify({ access_token: 't' }))
    return new Response(body(url), { status: status(url) })
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

  it('a Bing throttle is "throttled", not a failure (2026-11-21 ThrottleUser)', async () => {
    const f = fakeFetch(
      (u) => (u.includes('SubmitFeed') ? 400 : 200),
      () => '{"ErrorCode":4,"Message":"ERROR!!! ThrottleUser"}'
    )
    const lines: string[] = []
    const r = await submitSitemaps(
      target,
      { GSC_SERVICE_ACCOUNT_JSON: SA, BING_API_KEY: 'k' },
      f.impl,
      (l) => lines.push(l)
    )
    expect(r).toEqual({ gsc: 'ok', bing: 'throttled' })
    expect(lines.filter((l) => l.startsWith('::warning::'))).toHaveLength(0)
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

describe('gscSitemapProblems', () => {
  const NOW = new Date('2026-11-21T12:00:00Z')
  const feeds = sitemapFeeds(ROOT, INDEX)
  const read = (path: string, lastDownloaded?: string, errors = '0') => ({
    path,
    lastDownloaded,
    errors,
  })

  it('a child Google never read is a problem (tv.xml, 2026-11-21)', () => {
    const list = [
      read(ROOT, '2026-11-21T00:00:00Z'),
      read(feeds[1], '2026-11-21T00:00:00Z'),
      read(feeds[2]),
    ]
    expect(gscSitemapProblems(list, feeds, NOW)).toEqual([
      `${feeds[2]}: not read by Google since ever`,
    ])
  })

  it('names a child missing from GSC, a stale read and errors', () => {
    const list = [
      read(ROOT, '2026-11-10T00:00:00Z'),
      read(feeds[1], '2026-11-21T00:00:00Z', '3'),
    ]
    expect(gscSitemapProblems(list, feeds, NOW)).toEqual([
      `${ROOT}: not read by Google since 2026-11-10T00:00:00Z`,
      `${feeds[1]}: 3 errors`,
      `${feeds[2]}: not in Search Console`,
    ])
  })

  it('all read this week with no errors is clean', () => {
    const list = feeds.map((f) => read(f, '2026-11-15T12:00:01Z'))
    expect(gscSitemapProblems(list, feeds, NOW)).toEqual([])
  })
})

describe('bingSummary', () => {
  const day = (n: number, over: Record<string, number> = {}) => ({
    Date: `/Date(${Date.UTC(2026, 10, n)})/`,
    CrawledPages: 100,
    InIndex: 1000,
    CrawlErrors: 0,
    Code4xx: 0,
    Code5xx: 40,
    DnsFailures: 0,
    ConnectionTimeout: 1,
    BlockedByRobotsTxt: 1,
    ContainsMalware: 0,
    ...over,
  })
  const week = [13, 14, 15, 16, 17, 18, 19].map((n) => day(n))
  const read = (last: ReturnType<typeof day>) => ({
    GetUrlSubmissionQuota: { DailyQuota: 5, MonthlyQuota: 900 },
    GetCrawlIssues: [],
    GetCrawlStats: [...week, last],
  })

  it('a standing baseline (5xx ~40, a robots block) is not a problem', () => {
    expect(bingSummary(read(day(20))).problems).toEqual([])
  })

  it('a counter jumping off its week is (timeouts 1 → 27, 2026-11-20)', () => {
    expect(
      bingSummary(read(day(20, { ConnectionTimeout: 27 }))).problems
    ).toEqual(['ConnectionTimeout 27 on 2026-11-20 (week median 1)'])
  })

  it('a jump under 1% of a big crawl is a line, not a problem (48 of 6,125, 2026-11-21)', () => {
    const r = bingSummary(
      read(day(20, { CrawledPages: 6125, ConnectionTimeout: 48 }))
    )
    expect(r.problems).toEqual([])
    expect(r.lines.at(-1)).toBe(
      'ConnectionTimeout 48 on 2026-11-20 (week median 1), under 1% of the crawl'
    )
  })

  it('the index dropping below 80% of the week best is', () => {
    expect(bingSummary(read(day(20, { InIndex: 700 }))).problems).toEqual([
      'in index fell to 700 from 1000 this week',
    ])
  })

  it('no quota left is', () => {
    const r = read(day(20))
    r.GetUrlSubmissionQuota.DailyQuota = 0
    expect(bingSummary(r).problems).toEqual(['URL submission quota is 0 today'])
  })
})
