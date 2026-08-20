// One-shot Cloudflare WAF setup for reely.space.
//
// What this configures (all free-plan features):
//   1. Custom rule: allowlist social scrapers + search bots (skip later WAF/RL)
//   2. Custom rule: challenge obvious scraper UAs (python-requests, curl, etc.)
//   2b. Custom rule: challenge non-browser clients on detail pages — the one
//      route that actually costs Worker CPU. See CHALLENGE_DETAIL_SCRAPERS_RULE.
//   3. Rate limit: 100 req/10s per IP on /movies/[id] and /tv-shows/[id]
//      (high on purpose — see RATELIMIT_RULE: must clear Next.js prefetch bursts)
//   4. Bot Fight Mode: DISABLED — free-plan Bot Fight Mode runs outside the WAF
//      phases and CANNOT be bypassed by the skip/allow rule below, so it
//      challenges Googlebot/GSC and breaks sitemap fetching + indexing. Scraper
//      defense is handled by the BLOCK_RULE + rate limit instead.
//   5. Dynamic redirect: 301 apex (reely.space/*) → www.reely.space/*
//      Needs Zone.Dynamic Redirect: Edit on the API token — NOT Transform
//      Rules, which is a separate permission that does not cover redirects.
//      Measured on this token: `http_request_transform` reads fine (404, phase
//      simply not created) while `http_request_dynamic_redirect` is a flat 403.
//   6. Cache rule: marks /, /disclaimer, /movies and /tv-shows CDN-eligible.
//      MEASURED NO-OP on this zone — CF does not edge-cache Worker responses,
//      and every one of those paths is Worker-served. Kept and documented at
//      CACHE_RULE; do not count on it as the CPU defence, because it isn't one.
//   7. Tiered Cache (free on all plans): edge misses consult an upper-tier data
//      center before the origin Worker, so a cold render happens in a few tier
//      colos instead of independently across all ~300 edge locations.
//   8. TLS hardening: minimum TLS 1.2, SSL mode Full (Strict), and HSTS at 6
//      months + includeSubDomains (no preload). See the step for the reasoning
//      on each, especially why preload stays off.
//
// Idempotent — managed rules are identified by description prefix "[reely-waf]"
// and replaced on each run. Any other custom rules in the zone are preserved.
//
// Usage:
//   CLOUDFLARE_API_TOKEN=<token> pnpm waf:apply
//   CLOUDFLARE_API_TOKEN=<token> CF_ZONE_NAME=reely.space pnpm waf:apply
//
// Token needs these zone-level permissions on reely.space:
//   - Zone.Zone Settings: Edit    (Tiered Cache, min TLS, SSL mode, HSTS)
//   - Zone.Zone WAF: Edit         (custom rules + rate limit)
//   - Zone.Transform Rules: Edit  (the Vary-strip that makes the edge cache
//                                  actually cache — without it the step ✗-skips
//                                  and nothing on this zone is edge-cacheable)
//   - Zone.Dynamic Redirect: Edit (apex→www 301. A DIFFERENT permission from
//                                  Transform Rules; a token holding only the
//                                  latter gets 403 on the redirect phase and the
//                                  apex keeps getting indexed as a duplicate of
//                                  www. An already-created rule keeps working —
//                                  the permission gates changing it, so the ✗ is
//                                  "cannot re-assert", not "redirect is down")
//   - Zone.Cache Rules: Edit      (edge-cache rule — the 10ms-CPU defence)
//   - Zone.Bot Management: Edit   (optional, for Bot Fight Mode toggle)

import process from 'node:process'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const ZONE_NAME = process.env.CF_ZONE_NAME || 'reely.space'
const TAG = '[reely-waf]'

if (!TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN before running.')
  process.exit(1)
}

async function cf(path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  const json = await res.json()
  if (!res.ok || json.success === false) {
    const errs = (json.errors || [])
      .map((e) => `${e.code}: ${e.message}`)
      .join('; ')
    throw new Error(
      `${init.method || 'GET'} ${path} → ${res.status} ${errs || JSON.stringify(json)}`
    )
  }
  return json.result
}

async function getOrCreatePhaseEntrypoint(zoneId, phase) {
  try {
    return await cf(`/zones/${zoneId}/rulesets/phases/${phase}/entrypoint`)
  } catch (err) {
    // CF returns HTTP 200 + error code 10003 when the phase entrypoint hasn't
    // been created yet, so we match the error code/text rather than a status.
    const msg = String(err)
    const missing =
      msg.includes('404') ||
      msg.includes('10003') ||
      msg.includes('could not find entrypoint')
    if (!missing) throw err
  }
  return cf(`/zones/${zoneId}/rulesets`, {
    method: 'POST',
    body: JSON.stringify({
      name: `reely-${phase}`,
      kind: 'zone',
      phase,
      rules: [],
    }),
  })
}

function stripManaged(rules) {
  return (rules || []).filter((r) => !(r.description || '').startsWith(TAG))
}

function cleanRule(r) {
  const out = {
    description: r.description,
    expression: r.expression,
    action: r.action,
    enabled: r.enabled !== false,
  }
  if (r.action_parameters) out.action_parameters = r.action_parameters
  if (r.ratelimit) out.ratelimit = r.ratelimit
  return out
}

async function putRuleset(zoneId, ruleset, managedRules, opts = {}) {
  const { position = 'top', replaceAll = false } = opts
  const others = replaceAll ? [] : stripManaged(ruleset.rules).map(cleanRule)
  const ours = managedRules.map(cleanRule)
  const rules = position === 'top' ? [...ours, ...others] : [...others, ...ours]
  await cf(`/zones/${zoneId}/rulesets/${ruleset.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: ruleset.name,
      description: ruleset.description || '',
      kind: ruleset.kind,
      phase: ruleset.phase,
      rules,
    }),
  })
}

const SCRAPER_UAS = [
  'WhatsApp',
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'TelegramBot',
  'Slackbot',
  'Slack-ImgProxy',
  'Discordbot',
  'LinkedInBot',
  'Applebot',
  'redditbot',
  'Pinterest',
  'WordPress',
  'Googlebot',
  'bingbot',
  'DuckDuckBot',
  'YandexBot',
]

// `HeadlessChrome` is deliberately NOT here. It is the only token on this list
// that identifies a real browser engine, and the clients that send it are the
// ones that have to render this site to do their job: Google's OAuth brand
// review, Lighthouse, link previewers, uptime checkers. Challenging it cost
// three rejected verification rounds — the reviewer got the document, then a 403
// on every script, stylesheet and image, and reported a homepage that names
// nothing and explains nothing, which is exactly what an unhydrated shell is.
// A scraper that wants to hide sends a normal Chrome UA anyway; this token only
// ever caught the honest ones.
const BLOCK_UAS = [
  'python-requests',
  'scrapy',
  'Go-http-client',
  'node-fetch',
  'axios/',
  'okhttp',
  'PhantomJS',
  'wget/',
  'curl/',
]

const orExpr = (frags) =>
  frags.map((f) => `(http.user_agent contains "${f}")`).join(' or ')

/**
 * Extensions this site cannot serve, dropped at the edge.
 *
 * `not_found_handling: "none"` in wrangler.jsonc sends every unmatched path to
 * the Worker so a non-prerendered detail id can be answered — which also means
 * every junk request is a Worker invocation against the 100k/day cap. Measured
 * over 23h: ~1,700 requests for bare TMDB image paths (Googlebot-Image retrying
 * URLs this site has never emitted; every real image URL points at ImageKit) and
 * ~330 PHP/WordPress probes. That was ~10% of all invocations spent producing
 * 404s.
 *
 * The export contains zero .jpg/.jpeg and zero .php/.asp files — checked, not
 * assumed — so nothing legitimate can match. Icons are .png and .ico and are
 * deliberately NOT listed: those exist.
 *
 * Kept AHEAD of ALLOW_RULE on purpose. ALLOW_RULE skips the rest of the ruleset
 * for verified bots, and the biggest single source here IS a verified bot
 * (Googlebot-Image), so behind the allowlist this rule would never fire on the
 * traffic it was written for. The `cf.client.bot` carve-out below is therefore
 * inside this rule's own expression rather than delegated to the allowlist.
 */

// Attack probes. Nothing legitimate ever requests these — verified crawler or
// not — so they are blocked unconditionally. Googlebot has never asked for one.
const PROBE_EXTENSIONS = [
  '.php',
  '.asp',
  '.aspx',
  '.cgi',
  '.env',
  '.sql',
  '.bak',
]

// Stale and mis-split image URLs (a crawler splitting an ImageKit srcset on the
// commas inside it, or replaying a hash from a long-dead deploy). Blocked too —
// but NOT for verified crawlers. A 403 tells Googlebot "forbidden", which shows
// up in Search Console as "Blocked due to access forbidden" and is a worse
// signal than the truth: the URL simply does not exist. Measured 2026-08-03:
// Googlebot-Image 14/day and bingbot 13/day were getting 403 here where a 404 is
// the correct answer. Letting verified bots through costs one Worker invocation
// each (~30/day against a 100k cap) and buys a clean, honest 404.
const DEAD_IMAGE_EXTENSIONS = ['.jpg', '.jpeg']

const endsWithAny = (extensions) =>
  extensions
    .map((ext) => `ends_with(http.request.uri.path, "${ext}")`)
    .join(' or ')

const DEAD_EXTENSION_RULE = {
  description: `${TAG} block extensions this site never serves`,
  expression:
    `(${endsWithAny(PROBE_EXTENSIONS)})` +
    ` or ((${endsWithAny(DEAD_IMAGE_EXTENSIONS)}) and not cf.client.bot)`,
  action: 'block',
}

const ALLOW_RULE = {
  description: `${TAG} allow social scrapers and verified search bots`,
  // `cf.client.bot` is true for bots Cloudflare verified via reverse DNS
  // (Googlebot, Bingbot, etc.). Including it lets verified-bot infra bypass the
  // rate limit and Super Bot Fight Mode phases. NOTE: it does NOT exempt them
  // from free-plan Bot Fight Mode (that runs before these phases) — which is
  // why Bot Fight Mode is kept disabled below.
  expression: `(cf.client.bot) or ${orExpr(SCRAPER_UAS)}`,
  action: 'skip',
  action_parameters: {
    ruleset: 'current',
    phases: ['http_ratelimit', 'http_request_sbfm'],
    products: [
      'bic',
      'hot',
      'rateLimit',
      'securityLevel',
      'uaBlock',
      'waf',
      'zoneLockdown',
    ],
  },
}

// The billing webhook is the one endpoint on this site whose callers are all
// machines, and a managed challenge for a machine is a dropped payment: Buy Me a
// Coffee sees an HTML 403, retries a few times, and eventually stops — the money
// lands and the supporter never gets their grant, with nothing in our logs to say
// so. The path carries its own authentication (HMAC-SHA256 over the raw body,
// verified before the body is even parsed), so bot heuristics add nothing here
// that the signature does not already do better.
const WEBHOOK_PATH = '/api/billing/bmc'

/**
 * The pages an automated reviewer has to be able to read, exempt from the
 * user-agent challenge below.
 *
 * Google's OAuth brand review drives a headless browser and rejected this app
 * three times for a homepage that "does not explain the purpose of your app"
 * and an app name that "does not match the app name on your homepage". Both
 * described the challenge page it was actually served, not the site.
 *
 * Exempting these costs nothing that the challenge was buying: every one is a
 * prerendered static asset, matched before the Worker ever runs, so a headless
 * client reading them consumes no CPU and no invocation. The rule still guards
 * everything expensive — the detail and collection routes keep their own
 * stricter browser-token rule below.
 */
const REVIEW_PATHS = ['/', '/privacy', '/terms', '/disclaimer', '/support']

const EXEMPT_PATHS = [WEBHOOK_PATH, ...REVIEW_PATHS]

/**
 * The supporter calendar feed, exempt for the same reason the webhook is.
 *
 * What polls it is Google Calendar's fetcher, Apple's, or Outlook's — machines
 * with their own user-agents, none of which is a browser and one of which sends
 * none at all. A managed challenge for any of them is an HTML page where a
 * calendar expected an .ics, and the subscription goes permanently red with no
 * way for the supporter to fix it. A prefix rather than a path because the
 * credential is IN the path.
 *
 * Nothing is given away by exempting it: the token is 128 bits, unguessable, and
 * checked against a UNIQUE index, so an unauthenticated request costs one
 * indexed lookup and returns an empty calendar.
 */
const CALENDAR_PREFIX = '/api/calendar/'

/**
 * Everything a page needs in order to BE a page.
 *
 * Exempting the documents alone was half a fix and looked like a whole one: the
 * reviewer got `/` with a 200 and then a 403 on every chunk, stylesheet, icon
 * and image under it, so what it rendered was an unhydrated shell with no name
 * and no copy on it — the same two findings, now caused by the sub-resources
 * instead of the document. Measured after the first fix: `/` 200,
 * `/_next/static/chunks/*.js` 403, `/site.webmanifest` 403,
 * `/opengraph-image.png` 403, `/favicon.ico` 403.
 *
 * None of these can cost anything to serve. They are static assets matched
 * before the Worker, and a client that can already read the HTML gains nothing
 * from being denied the CSS.
 */
const ASSET_EXTENSIONS = [
  '.js',
  '.css',
  '.png',
  '.svg',
  '.ico',
  '.webmanifest',
  '.woff2',
  '.txt',
  '.xml',
  '.json',
  '.avif',
  '.webp',
]

const assetExpr = () =>
  [
    'starts_with(http.request.uri.path, "/_next/")',
    ...ASSET_EXTENSIONS.map(
      (ext) => `ends_with(http.request.uri.path, "${ext}")`
    ),
  ].join(' or ')

const notAnyPath = (paths) =>
  `not (${paths.map((p) => `http.request.uri.path eq "${p}"`).join(' or ')})`

const BLOCK_RULE = {
  description: `${TAG} challenge obvious scraper user-agents`,
  expression:
    `((${orExpr(BLOCK_UAS)}) or (http.user_agent eq ""))` +
    ` and ${notAnyPath(EXEMPT_PATHS)}` +
    ` and not starts_with(http.request.uri.path, "${CALENDAR_PREFIX}")` +
    ` and not (${assetExpr()})`,
  action: 'managed_challenge',
}

// Every token a real browser puts in its UA. Chrome sends "Chrome" AND "Safari";
// Edge adds "Edg"; Opera "OPR"; Firefox "Firefox". Anything hitting a detail
// page with none of these is not a person browsing the site.
const BROWSER_UAS = ['Chrome', 'Firefox', 'Safari', 'Edg', 'OPR', 'Gecko/']

// The detail pages are the only genuinely expensive route on this site, and only
// for ids outside the prerender set: Cloudflare does not edge-cache Worker HTML
// (CACHE_RULE below is a no-op for it — measured, no cf-cache-status on any HTML
// response, homepage included), and the incremental cache is read-only, so a
// non-prerendered id re-renders on the Worker on EVERY hit at 0.7-5.4s. That is
// what drives the free-plan CPU kills.
//
// The traffic doing it is not human. Of 2,193 5xx responses sampled over 2h,
// exactly 18 came from Chrome; the rest were unclassifiable user-agents walking
// TMDB ids (1,109 US / 411 SG / 408 EG). Widening the prerender set helps the
// head of the distribution but cannot bound an enumeration of the id space, so
// challenge the enumerators instead.
//
// Deliberately narrow, because a false positive here costs a real page view:
//   - detail + collection paths only — the homepage, browse lists and genre
//     pages are all prerendered and cheap, so they're left alone entirely;
//   - genre paths excluded (they start with the same prefix, and their
//     infinite-scroll fires server actions at these very paths);
//   - anything with a browser UA passes untouched;
//   - `not cf.client.bot` keeps verified crawlers out of it. ALLOW_RULE already
//     skips the rest of this ruleset for them and for the social scrapers, so
//     this is belt-and-braces — but it survives a future reorder, which the
//     ordering alone would not.
// managed_challenge, not block: a misclassified real client gets a puzzle and
// still reaches the page, rather than a door in the face.
const CHALLENGE_DETAIL_SCRAPERS_RULE = {
  description: `${TAG} challenge non-browser clients on detail pages`,
  expression: [
    '(starts_with(http.request.uri.path, "/movies/") or starts_with(http.request.uri.path, "/tv-shows/") or starts_with(http.request.uri.path, "/collection/"))',
    'not (starts_with(http.request.uri.path, "/movies/genre") or starts_with(http.request.uri.path, "/tv-shows/genre"))',
    // Year hubs (/movies/year/2019) are prerendered assets that never reach the
    // Worker. Challenging a crawler on one buys nothing and costs the ranking
    // the page exists for.
    'not (starts_with(http.request.uri.path, "/movies/year") or starts_with(http.request.uri.path, "/tv-shows/year"))',
    'not cf.client.bot',
    `not (${orExpr(BROWSER_UAS)})`,
  ].join(' and '),
  action: 'managed_challenge',
}

const RATELIMIT_RULE = {
  description: `${TAG} rate limit detail page scraping`,
  // Free plan doesn't allow `matches` (regex) in rate-limit expressions;
  // starts_with is the closest. `/movies` and `/tv-shows` (list pages) don't
  // have a trailing slash, so they're not caught — only detail pages match.
  // BUT `/movies/genre/<slug>` and `/tv-shows/genre/<slug>` also start with
  // `/movies/`/`/tv-shows/`, so without the `and not (...genre)` exclusion the
  // genre browse pages share this detail bucket — and their infinite-scroll
  // pagination fires server-action POSTs to the SAME path, which can trip the
  // limit and silently kill "load more" on scroll. Exclude genre paths (still
  // just starts_with, so free-plan compatible).
  expression:
    '(starts_with(http.request.uri.path, "/movies/") or starts_with(http.request.uri.path, "/tv-shows/")) and not (starts_with(http.request.uri.path, "/movies/genre") or starts_with(http.request.uri.path, "/tv-shows/genre")) and not (starts_with(http.request.uri.path, "/movies/year") or starts_with(http.request.uri.path, "/tv-shows/year"))',
  // Free plan only allows `block` for rate limits (no managed_challenge).
  action: 'block',
  // Free plan caps period to 10s and only lets the expression match on Path /
  // Verified Bot — NOT query string or headers. That matters: Next.js App
  // Router <Link> prefetches detail pages (`/movies/[id]?_rsc=...`) as they
  // enter the viewport, and those hit the SAME path as real navigation, so we
  // cannot exclude them. Card/watch-history links now use prefetch={false}
  // (hover-only), which killed the on-load viewport storm — but nav + hover
  // prefetch + real page-views still stack up. 300 req/10s (~1800/min) sits well
  // above any real browse session while still blocking bulk scrapers that hammer
  // full HTML pages. Was 100/10s; a homepage of carousels tripped it on load.
  ratelimit: {
    characteristics: ['ip.src', 'cf.colo.id'],
    period: 10,
    requests_per_period: 300,
    mitigation_timeout: 10,
  },
}

// The billing webhook is exempt, and it is the one path that should be.
//
// A 301 is not a 2xx, and a webhook sender that does not follow redirects — or
// that follows one by re-issuing a POST without its body, which is legal and
// common — sees a permanent failure, retries, and gives up. The dashboard field
// holding this URL is typed by hand once; a missing `www.` in it would cost real
// payments and show up nowhere. Serving the apex directly costs nothing: the
// route is signature-authenticated and reads no cookie, so the host it arrives
// on does not matter.
//
// The calendar feed rides along for the same reason: the clients that poll it
// are calendar fetchers, not browsers, and a subscription that was pasted
// without the `www.` would 301 forever. Some fetchers follow it, some quietly
// mark the calendar broken — and the supporter would have no way to tell which.
const MACHINE_HOST_EXEMPT =
  `not (http.request.uri.path eq "${WEBHOOK_PATH}")` +
  ` and not starts_with(http.request.uri.path, "${CALENDAR_PREFIX}")`

const REDIRECT_APEX_RULE = {
  description: `${TAG} 301 apex → www`,
  expression: `(http.host eq "${ZONE_NAME}") and ${MACHINE_HOST_EXEMPT}`,
  action: 'redirect',
  action_parameters: {
    from_value: {
      status_code: 301,
      target_url: {
        expression: `concat("https://www.${ZONE_NAME}", http.request.uri.path)`,
      },
      preserve_query_string: true,
    },
  },
}

// The public, cacheable page paths. `/watch-history` is intentionally excluded
// (personal + noindex). Keep in sync with next.config.mjs `headers()`.
const CACHEABLE_PATHS =
  '(http.request.uri.path eq "/") or (http.request.uri.path eq "/disclaimer") or (http.request.uri.path eq "/support") or (http.request.uri.path eq "/privacy") or (http.request.uri.path eq "/terms") or (http.request.uri.path eq "/people") or (http.request.uri.path eq "/rss.xml") or (starts_with(http.request.uri.path, "/person/")) or (starts_with(http.request.uri.path, "/movies")) or (starts_with(http.request.uri.path, "/tv-shows"))'

// Only full-document navigations/crawls are cached — NOT React Server Component
// requests. App Router prefetch + client navigation send `RSC: 1`; those hit
// the same URL as a real page load but return an RSC payload, not HTML. If both
// shared a cache entry they'd collide (HTML served to an RSC fetch or vice
// versa). Bypassing cache for RSC requests keeps one clean HTML entry per path;
// RSC still renders on the Worker (cheap, and it's a fraction of traffic).
const NOT_RSC = '(not any(http.request.headers["rsc"][*] == "1"))'

const CACHEABLE_EXPR = `${NOT_RSC} and (${CACHEABLE_PATHS})`

// LIVE. It was documented here as a known no-op — that was measured 2026-08-01,
// under OpenNext, and it was true then for a structural reason: Cache Rules
// govern what CF stores from an ORIGIN response, every one of these paths was
// served by the Worker, and Cloudflare does not edge-cache Worker-generated
// responses. No cf-cache-status header appeared on /movies/<id> or on the
// homepage. (VARY_STRIP_RULE below had already landed, so the absence was
// conclusive rather than ambiguous.)
//
// The static-export migration two days later changed the premise: these paths are
// plain assets now, matched before the Worker ever runs, so they are ordinary
// origin responses and the rule does what it always meant to. Re-measured
// 2026-08-06: `CF-Cache-Status: HIT` on `/`.
//
// That flips a consequence too. Repeat hits are now genuinely free — but a cached
// document also no longer notices that a deploy replaced the asset behind it, and
// nothing about the deploy invalidates the zone cache on its own. That is why the
// TTL below tracks the deploy interval and why scripts/cf-deploy.mjs purges after
// every deploy; without both, the edge silently pins the site to an old build.
const CACHE_RULE = {
  description: `${TAG} edge-cache public document pages, pin TTL + cache key`,
  expression: CACHEABLE_EXPR,
  action: 'set_cache_settings',
  action_parameters: {
    cache: true,
    // `override_origin` means THIS is the edge TTL — the `s-maxage` in
    // public/_headers does not set it (it only reaches caches that aren't this
    // zone). Held at the 6h scheduled-deploy interval in .github/workflows/
    // deploy.yml so a missed purge costs one cycle of staleness, not a day and a
    // half. Move the two together.
    edge_ttl: {
      mode: 'override_origin',
      default: 21600,
      status_code_ttl: [
        { status_code: 200, value: 21600 },
        { status_code_range: { from: 300, to: 399 }, value: 3600 },
        { status_code_range: { from: 400, to: 499 }, value: 60 },
        { status_code_range: { from: 500, to: 599 }, value: 0 },
      ],
    },
    browser_ttl: { mode: 'respect_origin' },
    cache_key: {
      ignore_query_strings_order: true,
      cache_deception_armor: true,
      custom_key: {
        query_string: { exclude: { all: true } },
      },
    },
    serve_stale: { disable_stale_while_updating: false },
    respect_strong_etags: false,
  },
}

// Next.js emits `Vary: rsc, next-router-state-tree, next-router-prefetch,
// next-router-segment-prefetch, next-url` on every App Router page. Cloudflare
// (free plan) treats any response with a Vary other than Accept-Encoding as
// UNCACHEABLE, so CACHE_RULE above never actually cached anything. Response
// header transform rules run before the response is written to cache (the same
// reason removing Set-Cookie makes a response cacheable), so stripping Vary here
// lets the edge cache the HTML. Scoped to the exact same document requests as
// CACHE_RULE — RSC requests keep their Vary and are never cached, so no HTML/RSC
// cache collision is possible. Needs Zone.Transform Rules: Edit — which is not
// what the redirect rule needs (that one wants Zone.Dynamic Redirect: Edit), so
// a token can hold one and 403 on the other.
const VARY_STRIP_RULE = {
  description: `${TAG} strip Vary on cacheable pages so CF will edge-cache them`,
  expression: CACHEABLE_EXPR,
  action: 'rewrite',
  action_parameters: {
    headers: {
      Vary: { operation: 'remove' },
    },
  },
}

// Each phase needs a DIFFERENT token permission, so a gap in one (e.g. Zone
// WAF: Edit missing) must not block the others — above all it must not block the
// edge-cache rule, which is the real defence against the 10ms Worker CPU limit.
// step() isolates each phase: logs ✓/✗, records the failure, and keeps going.
const failures = []
async function step(label, fn) {
  try {
    await fn()
    console.log(`✓ ${label}`)
    return true
  } catch (err) {
    console.warn(`✗ ${label}\n    ${err.message}`)
    failures.push(label)
    return false
  }
}

async function main() {
  const zones = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}`)
  if (!zones.length) throw new Error(`Zone not found: ${ZONE_NAME}`)
  const zoneId = zones[0].id
  console.log(`Zone: ${ZONE_NAME} (${zoneId})`)

  // Order matters: ALLOW_RULE skips the REST of this ruleset (`ruleset:
  // 'current'`) for verified bots and social scrapers, so it has to stay first —
  // everything below only ever sees traffic that isn't already trusted.
  //
  // WAF_PERMISSIVE=1 ships the allowlist and nothing that can challenge: no
  // user-agent challenge, no detail-page browser-token check, no rate limit, and
  // the junk-extension block stays because it only ever matches paths this site
  // does not serve. It exists for one situation — an external reviewer whose
  // client we cannot identify in advance has to be able to load the whole site,
  // and every remaining guess about which rule is in its way costs another
  // review cycle. Turn it on, get verified, run `pnpm waf:apply` without it.
  const permissive = process.env.WAF_PERMISSIVE === '1'
  if (permissive) {
    console.log(
      'WAF_PERMISSIVE=1 — challenge + rate-limit rules OFF for this run.'
    )
  }
  const customRules = permissive
    ? [DEAD_EXTENSION_RULE, ALLOW_RULE]
    : [
        DEAD_EXTENSION_RULE,
        ALLOW_RULE,
        BLOCK_RULE,
        CHALLENGE_DETAIL_SCRAPERS_RULE,
      ]
  await step(
    'Custom rules: allowlist + block-scrapers (needs Zone WAF: Edit)',
    async () => {
      const rs = await getOrCreatePhaseEntrypoint(
        zoneId,
        'http_request_firewall_custom'
      )
      await putRuleset(zoneId, rs, customRules, {
        position: 'top',
      })
    }
  )

  await step(
    `Redirect ${ZONE_NAME} → www (needs Zone Dynamic Redirect: Edit)`,
    async () => {
      const rs = await getOrCreatePhaseEntrypoint(
        zoneId,
        'http_request_dynamic_redirect'
      )
      await putRuleset(zoneId, rs, [REDIRECT_APEX_RULE], { position: 'top' })
    }
  )

  // --- The edge cache: the actual CPU fix. Needs BOTH of the next two. ---
  const cacheOk = await step(
    'Cache rule: edge-cache /, /disclaimer, /support, /privacy, /terms, /movies, /tv-shows (needs Zone Cache Rules: Edit)',
    async () => {
      const rs = await getOrCreatePhaseEntrypoint(
        zoneId,
        'http_request_cache_settings'
      )
      await putRuleset(zoneId, rs, [CACHE_RULE], { position: 'top' })
    }
  )
  const varyOk = await step(
    'Vary-strip: lets CF actually cache the HTML (needs Zone Transform Rules: Edit)',
    async () => {
      const rs = await getOrCreatePhaseEntrypoint(
        zoneId,
        'http_response_headers_transform'
      )
      await putRuleset(zoneId, rs, [VARY_STRIP_RULE], { position: 'top' })
    }
  )

  // Tiered Cache (free on all plans). Upper-tier colos absorb edge misses before
  // they reach the origin Worker, so cold renders collapse from ~300 edge
  // locations to a handful of tiers. Idempotent.
  await step('Tiered Cache on (needs Zone Settings: Edit)', async () => {
    await cf(`/zones/${zoneId}/argo/tiered_caching`, {
      method: 'PATCH',
      body: JSON.stringify({ value: 'on' }),
    })
  })

  // Early Hints off. It only re-serves `Link: rel=preload/preconnect` headers it
  // previously saw on an origin response, and nothing here ever sends one:
  // `public/_headers` defines none, and a static asset response carries none
  // either. So the feature can never emit a hint — but its cache-fill requests
  // still run, and they time out: a 2026-08-03 audit found ~23,000 of the zone's
  // ~23,300 daily 504s were internal, `requestSource: earlyHintsCache`, UA
  // "nginx-ssl early hints", `originResponseStatus: 0`. No eyeball ever saw one
  // (eyeball 5xx over the same 23h: zero), but they made the dashboard read as a
  // 25%-failure site and buried the real signal.
  //
  // This is NOT the prefetch that matters here: `Speculation-Rules` on every
  // response comes from Speed Brain, a separate setting that stays on. Turn this
  // back on if we ever start emitting real preload headers.
  await step('Early Hints off (needs Zone Settings: Edit)', async () => {
    await cf(`/zones/${zoneId}/settings/early_hints`, {
      method: 'PATCH',
      body: JSON.stringify({ value: 'off' }),
    })
  })

  // TLS hardening. All three are free-plan zone settings and idempotent.
  //
  // min_tls_version 1.2 — the zone shipped on the CF default of 1.0, which
  //   keeps TLS 1.0/1.1 handshakes alive for a site that has zero legacy
  //   clients (it is a 2026 React app). Nothing we serve needs them.
  // ssl 'strict' — Full, not Full (Strict), was in effect. The origin here is
  //   the Worker itself on a Custom Domain, so strict cannot break the origin
  //   leg; it just stops CF from ever accepting an unvalidated origin cert.
  // HSTS — was off entirely. 6 months + includeSubDomains, deliberately WITHOUT
  //   preload: max_age is the part browsers latch onto and cannot be revoked
  //   server-side, and preload is the part that is genuinely hard to undo, so
  //   it stays off until the policy has run clean for a while. nosniff is on
  //   here too; it duplicates the X-Content-Type-Options in next.config.mjs but
  //   also covers responses the Worker never renders (challenges, error pages).
  await step(
    'TLS: min 1.2, Full (Strict), HSTS 6mo (needs Zone Settings: Edit)',
    async () => {
      const tlsSettings = [
        ['min_tls_version', '1.2'],
        ['ssl', 'strict'],
        [
          'security_header',
          {
            strict_transport_security: {
              enabled: true,
              max_age: 15552000,
              include_subdomains: true,
              preload: false,
              nosniff: true,
            },
          },
        ],
      ]
      for (const [id, value] of tlsSettings) {
        await cf(`/zones/${zoneId}/settings/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ value }),
        })
      }
    }
  )

  // Free plan allows only 1 rate-limit rule. We replace any existing rule
  // (e.g. the default "Leaked credential check") since Reely has no auth.
  await step(
    'Rate limit: /movies/[id] and /tv-shows/[id] (needs Zone WAF: Edit)',
    async () => {
      const rs = await getOrCreatePhaseEntrypoint(zoneId, 'http_ratelimit')
      await putRuleset(zoneId, rs, permissive ? [] : [RATELIMIT_RULE], {
        replaceAll: true,
      })
    }
  )

  // Free-plan Bot Fight Mode is intentionally OFF — it runs before the WAF
  // phases so ALLOW_RULE can't exempt Googlebot/GSC, and left on it serves the
  // "Just a moment..." challenge that breaks sitemap fetching + indexing.
  //
  // JavaScript Detections goes off with it, and for a plainer reason: nothing
  // here reads what it produces. It injects /cdn-cgi/challenge-platform/scripts/
  // jsd/main.js into every HTML response to compute a bot SCORE — and every rule
  // in this file classifies on user-agent strings and `cf.client.bot` instead
  // (BLOCK_RULE, CHALLENGE_DETAIL_SCRAPERS_RULE), while the score itself is a
  // paid Bot Management feature we don't have. So it was a script every real
  // visitor executed to feed a signal no rule consults.
  //
  // It is not free: measured 2026-08-06 on mobile prod, jsd/main.js is a 360ms
  // long task on /disclaimer — a page that is otherwise static text and whose
  // TOTAL blocking time is ~1,020ms — and 434ms on the homepage, the second
  // largest long task there. Nothing defensive is lost: the UA rules, the
  // managed challenges, the rate limit and AI-bot blocking are all independent
  // of it.
  // `is_robots_txt_managed` goes off in the same call. Cloudflare turns it on by
  // default and it does not merge with ours — the edge SERVES ITS OWN
  // /robots.txt in place of the exported one, so app/robots.ts might as well not
  // exist. Measured 2026-08-08 on prod: our file has 1 `Sitemap:` line and the
  // AhrefsBot/SemrushBot blocks, the live one had 0 of either. Nothing was
  // blocked (CF's version allows search engines) but losing `Sitemap:` costs
  // sitemap auto-discovery, which is the whole reason robots.txt is served.
  //
  // `ai_bots_protection: 'block'` is NOT this setting and stays on: that is edge
  // enforcement against AI crawlers, robots.txt is only advisory. This PUT is a
  // partial merge — unlisted fields keep their values — so it does not disturb
  // it (proven by this very step, which has only ever sent the two booleans
  // below and left `ai_bots_protection` reading 'block').
  //
  // The one thing CF's file did that ours did not was disallow AI *training*
  // crawlers; those user-agents moved into app/robots.ts so nothing is lost.
  await step(
    'Bot Fight Mode + JS Detections + managed robots.txt off (needs Zone Bot Management: Edit)',
    async () => {
      await cf(`/zones/${zoneId}/bot_management`, {
        method: 'PUT',
        body: JSON.stringify({
          fight_mode: false,
          enable_js: false,
          is_robots_txt_managed: false,
        }),
      })
    }
  )

  // Green ONLY if edge caching is live (cache rule + Vary-strip both applied).
  // Secondary rules (WAF, rate limit, redirect, bot mode) can be skipped without
  // failing the run — they don't affect the CPU limit.
  console.log('')
  if (failures.length) {
    console.warn(
      `Skipped ${failures.length} of the above (missing token perms) — see ✗ lines.\n`
    )
  }
  if (!(cacheOk && varyOk)) {
    console.error(
      'FAILED: edge cache NOT applied — the cache rule and/or Vary-strip above failed.'
    )
    console.error(
      'Add BOTH to the token for reely.space: Zone · Cache Rules · Edit AND Zone · Transform Rules · Edit.'
    )
    process.exit(1)
  }
  console.log('✓ Edge cache rules APPLIED (cache rule + Vary-strip).')
  // "Applied" is not "working". Audited 2026-07-30: the Vary strip is confirmed
  // live (no Vary on /, /movies/:id, /tv-shows, /disclaimer) yet those responses
  // still carry NO cf-cache-status header at all, from two different colos. On a
  // Workers Custom Domain the Worker *is* the origin and runs ahead of the zone
  // cache, so the cache_settings phase never gets to store the HTML — static
  // assets under /_next/static DO show cf-cache-status: HIT, document routes
  // never do. Keep the rules (they cost nothing and become live if CF changes
  // this), but the real HTML caching is OpenNext's regional + KV incremental
  // cache, not the CDN. Do not treat this ✓ as proof of an edge HIT.
  console.log(
    '  Verify for real: curl -sI https://www.reely.space/movies/278 | grep -i cf-cache-status'
  )
}

main().catch((err) => {
  console.error('\nFAILED:', err.message)
  process.exit(1)
})
