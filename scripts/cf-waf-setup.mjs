// One-shot Cloudflare WAF setup for reely.space.
//
// What this configures (all free-plan features):
//   1. Custom rule: allowlist social scrapers + search bots (skip later WAF/RL)
//   2. Custom rule: challenge obvious scraper UAs (python-requests, curl, etc.)
//   3. Rate limit: 60 req/min per IP on /movies/[id] and /tv-shows/[id]
//   4. Bot Fight Mode: enabled
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
    if (!String(err).includes('404')) throw err
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
  expression: orExpr(SCRAPER_UAS),
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
  // Free plan caps period to 10s. 15 req/10s ≈ 90/min — well above human
  // browsing (clicking through pages), tight enough to bite bulk scrapers.
  ratelimit: {
    characteristics: ['ip.src', 'cf.colo.id'],
    period: 10,
    requests_per_period: 15,
    mitigation_timeout: 10,
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
