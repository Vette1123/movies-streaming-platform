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
//      Needs Zone.Transform Rules: Edit on the API token.
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
//   - Zone.Transform Rules: Edit  (apex→www redirect AND the Vary-strip that
//                                  makes the edge cache actually cache — without
//                                  this both silently ✗-skip and apex keeps
//                                  getting indexed as a duplicate of www)
//   - Zone.Cache Rules: Edit      (edge-cache rule — the 10ms-CPU defence)
//   - Zone.Bot Management: Edit   (optional, for Bot Fight Mode toggle)

import process from 'node:process'

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

const BLOCK_UAS = [
  'python-requests',
  'scrapy',
  'Go-http-client',
  'node-fetch',
  'axios/',
  'okhttp',
  'HeadlessChrome',
  'PhantomJS',
  'wget/',
  'curl/',
]

const orExpr = (frags) =>
  frags.map((f) => `(http.user_agent contains "${f}")`).join(' or ')

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

const BLOCK_RULE = {
  description: `${TAG} challenge obvious scraper user-agents`,
  expression: `(${orExpr(BLOCK_UAS)}) or (http.user_agent eq "")`,
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
    '(starts_with(http.request.uri.path, "/movies/") or starts_with(http.request.uri.path, "/tv-shows/")) and not (starts_with(http.request.uri.path, "/movies/genre") or starts_with(http.request.uri.path, "/tv-shows/genre"))',
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

const REDIRECT_APEX_RULE = {
  description: `${TAG} 301 apex → www`,
  expression: `(http.host eq "${ZONE_NAME}")`,
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
  '(http.request.uri.path eq "/") or (http.request.uri.path eq "/disclaimer") or (starts_with(http.request.uri.path, "/movies")) or (starts_with(http.request.uri.path, "/tv-shows"))'

// Only full-document navigations/crawls are cached — NOT React Server Component
// requests. App Router prefetch + client navigation send `RSC: 1`; those hit
// the same URL as a real page load but return an RSC payload, not HTML. If both
// shared a cache entry they'd collide (HTML served to an RSC fetch or vice
// versa). Bypassing cache for RSC requests keeps one clean HTML entry per path;
// RSC still renders on the Worker (cheap, and it's a fraction of traffic).
const NOT_RSC = '(not any(http.request.headers["rsc"][*] == "1"))'

const CACHEABLE_EXPR = `${NOT_RSC} and (${CACHEABLE_PATHS})`

// KNOWN NO-OP for this site's HTML — kept, documented, not trusted.
//
// The intent was: an edge HIT never runs the Worker, so CDN-caching the document
// routes would be the biggest defence against the free-plan 10ms CPU limit. It
// does not work, and the reason is structural rather than a misconfiguration:
// Cache Rules govern what CF stores from an ORIGIN response, and on this zone
// every one of these paths is served by the Worker itself. Cloudflare does not
// edge-cache Worker-generated responses. Measured 2026-08-01 with GET (not HEAD,
// which can hide it): no cf-cache-status header on /movies/<id>, and none on the
// homepage either — the whole document surface is uncached at the edge.
//
// VARY_STRIP_RULE below was the earlier fix for the same symptom and DID land
// (responses no longer carry Next's `Vary: rsc,...`), which is what makes the
// remaining absence conclusive rather than ambiguous.
//
// Consequence, and the reason CHALLENGE_DETAIL_SCRAPERS_RULE exists: repeat hits
// on the same URL are never free. Combined with a read-only incremental cache, a
// detail page outside the prerender set re-renders on the Worker every single
// time it is requested.
//
// Left in place because it costs nothing and becomes correct the moment any of
// these paths is served by something other than the Worker. Caching Worker HTML
// for real needs the Cache API inside the Worker, not a zone rule.
const CACHE_RULE = {
  description: `${TAG} edge-cache public document pages, pin TTL + cache key`,
  expression: CACHEABLE_EXPR,
  action: 'set_cache_settings',
  action_parameters: {
    cache: true,
    edge_ttl: {
      mode: 'override_origin',
      default: 28800,
      status_code_ttl: [
        { status_code: 200, value: 28800 },
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
// cache collision is possible. Needs Zone.Transform Rules: Edit (same token
// scope the redirect rule already uses).
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
  await step(
    'Custom rules: allowlist + block-scrapers (needs Zone WAF: Edit)',
    async () => {
      const rs = await getOrCreatePhaseEntrypoint(
        zoneId,
        'http_request_firewall_custom'
      )
      await putRuleset(
        zoneId,
        rs,
        [ALLOW_RULE, BLOCK_RULE, CHALLENGE_DETAIL_SCRAPERS_RULE],
        {
          position: 'top',
        }
      )
    }
  )

  await step(
    `Redirect ${ZONE_NAME} → www (needs Zone Transform Rules: Edit)`,
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
    'Cache rule: edge-cache /, /disclaimer, /movies, /tv-shows (needs Zone Cache Rules: Edit)',
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
      await putRuleset(zoneId, rs, [RATELIMIT_RULE], { replaceAll: true })
    }
  )

  // Free-plan Bot Fight Mode is intentionally OFF — it runs before the WAF
  // phases so ALLOW_RULE can't exempt Googlebot/GSC, and left on it serves the
  // "Just a moment..." challenge that breaks sitemap fetching + indexing.
  await step(
    'Bot Fight Mode off (needs Zone Bot Management: Edit)',
    async () => {
      await cf(`/zones/${zoneId}/bot_management`, {
        method: 'PUT',
        body: JSON.stringify({ fight_mode: false }),
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
