// Cloudflare notification policies: the free alerts that tell us when
// something outside the code has gone wrong with reely.space.
//
// Until 2026-11-13 the account had none. An abuse report against a site that
// embeds third-party players, a Trust & Safety block on the domain, a failed
// Universal SSL renewal or an L7 DDoS would all have happened silently, and
// PostHog cannot see any of them: a blocked or certificate-less site sends no
// events at all.
//
// Every alert goes to SUPPORT_EMAIL (config/support.ts), which Email Routing
// forwards to the owner's inbox, so no personal address lives in the repo.
//
// Idempotent: a policy whose alert_type already exists is left alone, so a
// filter or address changed in the dashboard is not overwritten.
//
// Usage:
//   pnpm cf:alerts            create what is missing
//   DRY_RUN=1 pnpm cf:alerts  print, change nothing
//
// Needs Account → Notifications: Edit on CLOUDFLARE_API_TOKEN.

import process from 'node:process'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const ZONE_NAME = process.env.CF_ZONE_NAME || 'reely.space'
const DRY_RUN = process.env.DRY_RUN === '1'
// Kept in sync with SUPPORT_EMAIL in config/support.ts (a .ts module, which
// this plain-node script cannot import).
const ALERT_EMAIL = 'support@reely.space'

// [alert_type, name]. Only types the Free plan offers; the ones left out are
// paid (health checks, origin monitoring) or would mail about every Cloudflare
// incident on every product. None of these accepts a filter (a `zones` filter
// is rejected with 17007): they cover every zone on the account, which is
// reely.space alone.
const POLICIES = [
  ['abuse_report_alert', 'Abuse report filed against the account'],
  ['block_notification_new_block', 'Trust & Safety blocked a URL'],
  [
    'block_notification_review_rejected',
    'Trust & Safety rejected a block review',
  ],
  ['block_notification_block_removed', 'Trust & Safety removed a block'],
  // No universal_ssl_event_type: it mails on every routine issue/renew/deploy
  // of a certificate, not only on failure (removed 2026-11-13 as noise).
  ['dos_attack_l7', 'HTTP DDoS attack mitigated'],
  ['security_insights_alert', 'New Security Center insight'],
]

if (!TOKEN) {
  console.error('CLOUDFLARE_API_TOKEN is not set (.env.local)')
  process.exit(1)
}

async function cf(path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  })
  const json = await res.json()
  if (!json.success) {
    const msg = (json.errors || []).map((e) => `${e.code} ${e.message}`)
    throw new Error(`${init.method || 'GET'} ${path}: ${msg.join('; ')}`)
  }
  return json.result
}

async function main() {
  const [zone] = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}`)
  if (!zone) throw new Error(`Zone not found: ${ZONE_NAME}`)
  const account = zone.account.id
  const existing = await cf(`/accounts/${account}/alerting/v3/policies`)
  const have = new Set(existing.map((p) => p.alert_type))
  console.log(
    `Account ${account}: ${existing.length} existing policies → ${ALERT_EMAIL}${DRY_RUN ? '  [DRY RUN]' : ''}\n`
  )

  let failed = 0
  for (const [type, name] of POLICIES) {
    if (have.has(type)) {
      console.log(`• ${type} — already present`)
      continue
    }
    if (DRY_RUN) {
      console.log(`~ ${type} — would create`)
      continue
    }
    try {
      await cf(`/accounts/${account}/alerting/v3/policies`, {
        method: 'POST',
        body: JSON.stringify({
          name: `Reely: ${name}`,
          alert_type: type,
          enabled: true,
          mechanisms: { email: [{ id: ALERT_EMAIL }] },
          filters: {},
        }),
      })
      console.log(`✓ ${type}`)
    } catch (err) {
      failed++
      console.log(`✗ ${type} — ${err.message}`)
    }
  }

  if (failed) {
    console.error(`\n${failed} of ${POLICIES.length} policies failed`)
    process.exit(1)
  }
  console.log(
    DRY_RUN
      ? '\nDry run: nothing created.'
      : `\nAll ${POLICIES.length} alert policies in place.`
  )
}

main().catch((err) => {
  console.error('\nFAILED:', err.message)
  process.exit(1)
})
