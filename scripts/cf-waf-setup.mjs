// One-shot Cloudflare WAF setup for reely.space.
//
// What this configures (all free-plan features):
//   1. Custom rule: allowlist social scrapers + search bots (skip later WAF/RL)
//   2. Custom rule: challenge obvious scraper UAs (python-requests, curl, etc.)
//   3. Rate limit: 100 req/10s per IP on /movies/[id] and /tv-shows/[id]
//      (high on purpose — see RATELIMIT_RULE: must clear Next.js prefetch bursts)
//   4. Bot Fight Mode: enabled
//   5. Dynamic redirect: 301 apex (reely.space/*) → www.reely.space/*
//      Needs Zone.Transform Rules: Edit on the API token.
//   6. Cache rule: force /movies and /tv-shows paths to be CDN-eligible
//      (Worker responses bypass cache by default). Needs Zone.Cache Rules.
//
// Idempotent — managed rules are identified by description prefix "[reely-waf]"
// and replaced on each run. Any other custom rules in the zone are preserved.
//
// Usage:
//   CLOUDFLARE_API_TOKEN=<token> pnpm waf:apply
//   CLOUDFLARE_API_TOKEN=<token> CF_ZONE_NAME=reely.space pnpm waf:apply
//
// Token needs these zone-level permissions on reely.space:
//   - Zone.Zone Settings: Edit
//   - Zone.Zone WAF: Edit
//   - Zone.Bot Management: Edit  (optional, for Bot Fight Mode toggle)

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
  // (Googlebot, Bingbot, etc.). Including it ensures GSC's sitemap fetcher
  // and other verified-bot infra bypass Bot Fight Mode regardless of how
  // their UA string looks at the edge.
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
  expression:
    'starts_with(http.request.uri.path, "/movies/") or starts_with(http.request.uri.path, "/tv-shows/")',
  // Free plan only allows `block` for rate limits (no managed_challenge).
  action: 'block',
  // Free plan caps period to 10s and only lets the expression match on Path /
  // Verified Bot — NOT query string or headers. That matters: Next.js App
  // Router <Link> prefetches detail pages (`/movies/[id]?_rsc=...`) as they
  // enter the viewport, and those hit the SAME path as real navigation, so we
  // cannot exclude them. A content-dense grid can fire dozens of prefetches in
  // one 10s window. The threshold therefore has to clear a normal browser's
  // prefetch burst, not just human page-views: 100 req/10s (~600/min) sits well
  // above any real scroll-and-browse session while still blocking bulk scrapers
  // that hammer full HTML pages. Lower it only if you confirm prefetch is off.
  ratelimit: {
    characteristics: ['ip.src', 'cf.colo.id'],
    period: 10,
    requests_per_period: 100,
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

// Worker responses skip CF's edge cache by default; this rule overrides that
// for the routes we want CDN-cached and pins the TTL ourselves.
//
// Why not `mode: 'respect_origin'`? The origin Cache-Control is correct, but
// Next.js also emits `Vary: rsc, next-router-state-tree, next-router-prefetch,
// next-router-segment-prefetch` for App Router client navigation. CF respects
// Vary, so each value-combination of those headers would get a separate cache
// entry — and prefetch traffic would fill the cache without ever HIT'ing on
// real navigation. We pin the cache key to just method+host+path+device so
// real Googlebot/user GETs collide on the same entry.
const CACHE_RULE = {
  description: `${TAG} edge-cache detail pages, pin TTL + cache key`,
  expression:
    '(starts_with(http.request.uri.path, "/movies")) or (starts_with(http.request.uri.path, "/tv-shows"))',
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

async function main() {
  const zones = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}`)
  if (!zones.length) throw new Error(`Zone not found: ${ZONE_NAME}`)
  const zoneId = zones[0].id
  console.log(`Zone: ${ZONE_NAME} (${zoneId})`)

  const customRs = await getOrCreatePhaseEntrypoint(zoneId, 'http_request_firewall_custom')
  await putRuleset(zoneId, customRs, [ALLOW_RULE, BLOCK_RULE], { position: 'top' })
  console.log('✓ Custom rules: allowlist + block-scrapers')

  const redirectRs = await getOrCreatePhaseEntrypoint(zoneId, 'http_request_dynamic_redirect')
  await putRuleset(zoneId, redirectRs, [REDIRECT_APEX_RULE], { position: 'top' })
  console.log(`✓ Redirect rule: ${ZONE_NAME} → www.${ZONE_NAME}`)

  const cacheRs = await getOrCreatePhaseEntrypoint(zoneId, 'http_request_cache_settings')
  await putRuleset(zoneId, cacheRs, [CACHE_RULE], { position: 'top' })
  console.log('✓ Cache rule: /movies, /tv-shows edge-cacheable (respect origin)')

  // Free plan allows only 1 rate-limit rule. We replace any existing rule
  // (e.g. the default "Leaked credential check") since Reely has no auth.
  const rlRs = await getOrCreatePhaseEntrypoint(zoneId, 'http_ratelimit')
  await putRuleset(zoneId, rlRs, [RATELIMIT_RULE], { replaceAll: true })
  console.log('✓ Rate limit: /movies/[id] and /tv-shows/[id]')

  try {
    await cf(`/zones/${zoneId}/bot_management`, {
      method: 'PUT',
      body: JSON.stringify({ fight_mode: true }),
    })
    console.log('✓ Bot Fight Mode enabled')
  } catch (err) {
    console.warn(`! Bot Fight Mode toggle skipped: ${err.message}`)
    console.warn('  Enable it manually at Security → Bots if you want it on.')
  }

  console.log('\nDone. Verify at:')
  console.log(`  https://dash.cloudflare.com/?to=/:account/${ZONE_NAME}/security/waf`)
}

main().catch((err) => {
  console.error('\nFAILED:', err.message)
  process.exit(1)
})
