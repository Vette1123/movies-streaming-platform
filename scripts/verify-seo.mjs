// Checks the deployed pages for the things an SEO crawl reports on, none of
// which any build step can catch.
//
// The one that prompted this: the fallback shells set `noindex, nofollow` so
// their own bare URLs stay out of the index, and cloudflare/worker.js serves
// that same HTML as the real /movies/<id> for every id outside the prerendered
// set — so the whole tail of the site was asking Google not to index it, and
// nothing anywhere would have told us. The shells carry no such tag now; they
// are noindex by header (public/_headers), which stays with the URL.
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
  return { status: res.status, headers: res.headers, html: await res.text() }
}

const first = (html, re) => re.exec(html)?.[1] ?? null
const robotsOf = (html) => first(html, /<meta name="robots" content="([^"]*)"/i)
const descOf = (html) =>
  first(html, /<meta name="description" content="([^"]*)"/i) ?? ''
// What Bing calls "too short". It reported 53 pages at this, all of them detail
// pages whose TMDB overview is one line — see lib/seo-description.ts.
const MIN_DESCRIPTION = 110
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
/** A tail page below this is a template with a title in it, not a page. */
const MIN_FALLBACK_BODY = 500

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
  const description = descOf(html)
  const wantCanonical = `${ORIGIN.replace('https://', 'https://www.')}${path === '/' ? '' : path}`
  const ok =
    status === 200 &&
    !/noindex/i.test(robots) &&
    h1s.length >= 1 &&
    description.length >= MIN_DESCRIPTION &&
    canonical === wantCanonical
  check(
    `indexable  ${path}`,
    ok,
    `${status} robots="${robots}" h1=${h1s.length} desc=${description.length} canonical=${canonical === wantCanonical ? 'self' : canonical}`
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
  // The fallback's <h1> exists FOR the crawler that runs no JS. It shipped
  // inside `<div hidden>` — display:none, which a crawler reads as absent —
  // and Bing duly reported tail pages under "The <h1> tag is missing". Clipped
  // is fine; hidden is not.
  const block = /<div[^>]*data-fallback-seo[^>]*>/i.exec(html)?.[0] ?? ''
  check(
    'fallback SEO block is clipped, not display:none',
    block !== '' && !/\shidden(\s|=|>)/i.test(block),
    block || 'no block found'
  )

  // …and it says something. A heading and a 158-character description over a
  // nav and a footer identical on ~13,900 other tail URLs is what Google filed
  // as Soft 404 and "Duplicate without user-selected canonical". The body is
  // built by lib/seo-facts.ts; this is the check that it is still there.
  const body =
    /<div[^>]*data-fallback-seo[^>]*>([\s\S]*?)<\/div>/i.exec(html)?.[1] ?? ''
  const visible = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  check(
    'fallback carries a real body, not just a heading',
    visible.length >= MIN_FALLBACK_BODY && /<dl>/i.test(body),
    `${visible.length} chars, facts=${/<dl>/i.test(body)}`
  )
}

// ---- the sitemap covers what the site LINKS to -----------------------------
//
// Every detail page ends in similar/recommended rails pointing at ids outside
// the prerendered set. Those anchors are in the HTML, so a crawler walks
// straight off the prerendered set — and Bing reported three of the pages it
// landed on as missing from the sitemap, one of them as never submitted to
// IndexNow. app/sitemap.ts advertises them now (buildLinkedMediaIds); this is
// the check that says so.
{
  const { html } = await get('/movies/550')
  const linked = [
    ...new Set(
      [...html.matchAll(/href="(\/(?:movies|tv-shows)\/\d+)"/g)].map(
        (m) => m[1]
      )
    ),
  ]
  const paths = new Set(locs.map((u) => new URL(u).pathname))
  const missing = linked.filter((p) => !paths.has(p))
  check(
    'sitemap lists every title a detail page links to',
    linked.length > 0 && missing.length === 0,
    `${linked.length} linked, ${missing.length} missing${missing.length ? `: ${missing.slice(0, 5).join(', ')}` : ''}`
  )
}

// ---- pages that must NOT be indexed ----------------------------------------
//
// The four shells are noindex by HEADER, not by a meta tag. The tag used to be
// in their HTML, and their HTML is what the Worker serves as the real
// /movies/<id> — the Worker strips it, but React puts it back on hydration and
// Googlebot renders JS, which is how 9,274 real pages were filed under
// "Excluded by 'noindex' tag". So this asserts the OPPOSITE of what it used
// to for those paths: the header says noindex, and the body must not.
for (const path of [
  '/media-fallback',
  '/collection-fallback',
  '/list-fallback',
  '/profile-fallback',
]) {
  const { headers, html } = await get(path)
  const header = headers.get('x-robots-tag') ?? ''
  const meta = robotsOf(html) ?? ''
  check(
    `noindex by header, not by meta  ${path}`,
    /noindex/i.test(header) && !/noindex/i.test(meta),
    `X-Robots-Tag="${header}" meta="${meta}"`
  )
}

// The one page that is noindex in its own right — it is nobody's shell.
{
  const { html } = await get('/watch-history')
  const robots = robotsOf(html) ?? ''
  check(
    'noindex  /watch-history',
    /noindex/i.test(robots),
    `robots="${robots}"`
  )
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
