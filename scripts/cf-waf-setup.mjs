// One-shot Cloudflare WAF setup for reely.space.
//
// What this configures (all free-plan features):
//   1. Custom rule: allowlist social scrapers + search bots (skip later WAF/RL)
//   2. Custom rule: challenge obvious scraper UAs (python-requests, curl, etc.)
//   3. Rate limit: 100 req/10s per IP on /movies/[id] and /tv-shows/[id]
//      (high on purpose — see RATELIMIT_RULE: must clear Next.js prefetch bursts)
//   4. Bot Fight Mode: DISABLED — free-plan Bot Fight Mode runs outside the WAF
//      phases and CANNOT be bypassed by the skip/allow rule below, so it
//      challenges Googlebot/GSC and breaks sitemap fetching + indexing. Scraper
//      defense is handled by the BLOCK_RULE + rate limit instead.
//   5. Dynamic redirect: 301 apex (reely.space/*) → www.reely.space/*
//      Needs Zone.Transform Rules: Edit on the API token.
//   6. Cache rule: force /, /disclaimer, /movies and /tv-shows paths to be
//      CDN-eligible (Worker responses bypass cache by default). This is what
//      keeps the free-plan 10ms Worker CPU limit from being hit under traffic —
//      an edge HIT never runs the Worker. Needs Zone.Cache Rules.
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
    const errs = (json.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ')
    throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${errs || JSON.stringify(json)}`)
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
    const missing = msg.includes('404') || msg.includes('10003') || msg.includes('could not find entrypoint')
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
  const others = replaceAll
    ? []
    : stripManaged(ruleset.rules).map(cleanRule)
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
    products: ['bic', 'hot', 'rateLimit', 'securityLevel', 'uaBlock', 'waf', 'zoneLockdown'],
  },
}

const BLOCK_RULE = {
  description: `${TAG} challenge obvious scraper user-agents`,
  expression: `(${orExpr(BLOCK_UAS)}) or (http.user_agent eq "")`,
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

// Worker responses skip CF's edge cache by default; this rule overrides that
// for the routes we want CDN-cached and pins the TTL ourselves. An edge HIT
// never runs the Worker, so it's the single biggest defence against the
// free-plan 10ms CPU limit. Works together with VARY_STRIP_RULE below — CF
// won't cache a response carrying Next.js's `Vary: rsc,...` header, so that
// header is stripped (in the response phase, before the cache stores) for these
// same requests. Without the strip, this rule is a no-op (proven in prod:
// responses returned no cf-cache-status at all).
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

  await step('Custom rules: allowlist + block-scrapers (needs Zone WAF: Edit)', async () => {
    const rs = await getOrCreatePhaseEntrypoint(zoneId, 'http_request_firewall_custom')
    await putRuleset(zoneId, rs, [ALLOW_RULE, BLOCK_RULE], { position: 'top' })
  })

  await step(`Redirect ${ZONE_NAME} → www (needs Zone Transform Rules: Edit)`, async () => {
    const rs = await getOrCreatePhaseEntrypoint(zoneId, 'http_request_dynamic_redirect')
    await putRuleset(zoneId, rs, [REDIRECT_APEX_RULE], { position: 'top' })
  })

  // --- The edge cache: the actual CPU fix. Needs BOTH of the next two. ---
  const cacheOk = await step(
    'Cache rule: edge-cache /, /disclaimer, /movies, /tv-shows (needs Zone Cache Rules: Edit)',
    async () => {
      const rs = await getOrCreatePhaseEntrypoint(zoneId, 'http_request_cache_settings')
      await putRuleset(zoneId, rs, [CACHE_RULE], { position: 'top' })
    }
  )
  const varyOk = await step(
    'Vary-strip: lets CF actually cache the HTML (needs Zone Transform Rules: Edit)',
    async () => {
      const rs = await getOrCreatePhaseEntrypoint(zoneId, 'http_response_headers_transform')
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
  await step('TLS: min 1.2, Full (Strict), HSTS 6mo (needs Zone Settings: Edit)', async () => {
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
  })

  // Free plan allows only 1 rate-limit rule. We replace any existing rule
  // (e.g. the default "Leaked credential check") since Reely has no auth.
  await step('Rate limit: /movies/[id] and /tv-shows/[id] (needs Zone WAF: Edit)', async () => {
    const rs = await getOrCreatePhaseEntrypoint(zoneId, 'http_ratelimit')
    await putRuleset(zoneId, rs, [RATELIMIT_RULE], { replaceAll: true })
  })

  // Free-plan Bot Fight Mode is intentionally OFF — it runs before the WAF
  // phases so ALLOW_RULE can't exempt Googlebot/GSC, and left on it serves the
  // "Just a moment..." challenge that breaks sitemap fetching + indexing.
  await step('Bot Fight Mode off (needs Zone Bot Management: Edit)', async () => {
    await cf(`/zones/${zoneId}/bot_management`, {
      method: 'PUT',
      body: JSON.stringify({ fight_mode: false }),
    })
  })

  // Green ONLY if edge caching is live (cache rule + Vary-strip both applied).
  // Secondary rules (WAF, rate limit, redirect, bot mode) can be skipped without
  // failing the run — they don't affect the CPU limit.
  console.log('')
  if (failures.length) {
    console.warn(`Skipped ${failures.length} of the above (missing token perms) — see ✗ lines.\n`)
  }
  if (!(cacheOk && varyOk)) {
    console.error('FAILED: edge cache NOT applied — the cache rule and/or Vary-strip above failed.')
    console.error('Add BOTH to the token for reely.space: Zone · Cache Rules · Edit AND Zone · Transform Rules · Edit.')
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
  console.log('  Verify for real: curl -sI https://www.reely.space/movies/278 | grep -i cf-cache-status')
}

main().catch((err) => {
  console.error('\nFAILED:', err.message)
  process.exit(1)
})
