// Checks the deployed pages for the things an SEO crawl reports on, none of
// which any build step can catch.
//
// The one that prompted this: app/media-fallback/layout.tsx sets `noindex,
// nofollow` so its own bare URL stays out of the index, and cloudflare/worker.js
// serves that same HTML as the real /movies/<id> for every id outside the
// prerendered set — so the whole tail of the site was asking Google not to
// index it, and nothing anywhere would have told us.
//
// Run: pnpm seo:verify              (against production)
//      pnpm seo:verify http://localhost:3000
const ORIGIN = process.argv[2] || 'https://reely.space'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const results = []
const check = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`
  )
}

const get = async (path) => {
  const res = await fetch(path.startsWith('http') ? path : `${ORIGIN}${path}`, {
    headers: { 'user-agent': UA },
  })
  return { status: res.status, html: await res.text() }
}

const first = (html, re) => re.exec(html)?.[1] ?? null
const robotsOf = (html) => first(html, /<meta name="robots" content="([^"]*)"/i)
const canonicalOf = (html) =>
  first(html, /<link rel="canonical" href="([^"]*)"/i)
const h1sOf = (html) =>
  [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim()
  )

// ---- sitemap ---------------------------------------------------------------
const { html: xml } = await get('/sitemap.xml')
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
const count = (prefix) =>
  locs.filter((u) => new URL(u).pathname.startsWith(prefix)).length

console.log(
  `sitemap: ${locs.length} urls — movies ${count('/movies/')}, tv ${count('/tv-shows/')}, collections ${count('/collection/')}\n`
)
check(
  'sitemap lists movie detail pages',
  count('/movies/') > 300,
  `${count('/movies/')} urls`
)
check(
  'sitemap lists tv detail pages',
  count('/tv-shows/') > 200,
  `${count('/tv-shows/')} urls`
)
check(
  'sitemap lists collection pages',
  count('/collection/') > 0,
  `${count('/collection/')} urls`
)
check(
  'no duplicate sitemap entries',
  new Set(locs).size === locs.length,
  `${locs.length - new Set(locs).size} dupes`
)

// ---- indexable pages -------------------------------------------------------
// A sample across every shape, plus a tail id the build does not prerender.
const TAIL_ID = '/movies/9340' // The Goonies — outside the prerendered set
const INDEXABLE = [
  '/',
  '/movies',
  '/tv-shows',
  '/movies/genre/action',
  '/tv-shows/genre/action-and-adventure',
  '/movies/550',
  TAIL_ID,
  ...locs.slice(0, 6).map((u) => new URL(u).pathname),
]

for (const path of [...new Set(INDEXABLE)]) {
  const { status, html } = await get(path)
  const robots = robotsOf(html) ?? ''
  const canonical = canonicalOf(html)
  const h1s = h1sOf(html)
  const wantCanonical = `${ORIGIN.replace('https://', 'https://www.')}${path === '/' ? '' : path}`
  const ok =
    status === 200 &&
    !/noindex/i.test(robots) &&
    h1s.length >= 1 &&
    canonical === wantCanonical
  check(
    `indexable  ${path}`,
    ok,
    `${status} robots="${robots}" h1=${h1s.length} canonical=${canonical === wantCanonical ? 'self' : canonical}`
  )
}

// The tail page is the whole point of the exercise — call it out separately.
{
  const { html } = await get(TAIL_ID)
  check(
    'tail page is served from the shell (worker path)',
    html.includes('data-fallback-seo'),
    'no data-fallback-seo marker — pick a different TAIL_ID, this one got prerendered'
  )
}

// ---- pages that must NOT be indexed ----------------------------------------
for (const path of [
  '/media-fallback',
  '/collection-fallback',
  '/watch-history',
]) {
  const { html } = await get(path)
  const robots = robotsOf(html) ?? ''
  check(`noindex  ${path}`, /noindex/i.test(robots), `robots="${robots}"`)
}

// The 404 needs an h1 too: it is a real page a crawler renders, and a document
// whose top heading is an h2 has no title for a screen reader either.
{
  const { status, html } = await get('/definitely-not-a-real-page')
  check(
    '404 returns 404 with an h1',
    status === 404 && h1sOf(html).length >= 1,
    `${status}, h1=${h1sOf(html).length}`
  )
}

// ---- robots.txt ------------------------------------------------------------
//
// These fail while Cloudflare's managed robots.txt is enabled on the zone: it
// is injected at the edge and REPLACES the exported /robots.txt outright, so
// app/robots.ts might as well not exist. Its own rules allow search engines, so
// nothing is blocked — but the `Sitemap:` line goes with it, and that is a
// primary way Google discovers a sitemap without a Search Console submission.
// Turn it off under AI Crawl Control in the dashboard, or accept the loss and
// keep the sitemap submitted in Search Console.
{
  const { html: txt } = await get('/robots.txt')
  const managed = /Cloudflare Managed [Cc]ontent|Content-Signal:/.test(txt)
  const hint = managed
    ? 'Cloudflare managed robots.txt is overriding app/robots.ts'
    : 'served from app/robots.ts'
  for (const path of ['/media-fallback', '/collection-fallback']) {
    check(
      `robots.txt disallows ${path}`,
      txt.includes(`Disallow: ${path}`),
      hint
    )
  }
  check('robots.txt points at the sitemap', /Sitemap:\s*\S+/i.test(txt), hint)
}

const failed = results.filter((r) => !r.pass)
console.log(
  `\n${results.length - failed.length}/${results.length} passed on ${ORIGIN}`
)
if (failed.length) {
  console.log(
    'FAILURES:\n' + failed.map((f) => `  - ${f.name} (${f.detail})`).join('\n')
  )
  process.exit(1)
}
