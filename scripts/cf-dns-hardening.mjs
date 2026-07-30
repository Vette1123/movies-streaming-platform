// DNS hardening for reely.space: CAA records + the DMARC policy ramp.
//
// Split out from cf-waf-setup.mjs on purpose. That script runs on every CI
// deploy; this one must not. Tightening DMARC is a deliberate multi-week ramp
// (none → quarantine at 25% → quarantine at 100% → reject) where each step is
// only safe after reading the aggregate reports from the previous one, and an
// automatic re-apply on deploy would either freeze the ramp or silently undo a
// manual change.
//
// Usage:
//   CLOUDFLARE_API_TOKEN=<token> pnpm dns:harden
//   DMARC_POLICY=reject DMARC_PCT=100 CLOUDFLARE_API_TOKEN=<token> pnpm dns:harden
//   DRY_RUN=1 CLOUDFLARE_API_TOKEN=<token> pnpm dns:harden
//
// Token needs Zone.DNS: Edit on reely.space, which is NOT part of the set
// cf-waf-setup.mjs needs — the deploy token deliberately has no DNS access.

import process from 'node:process'

const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const ZONE_NAME = process.env.CF_ZONE_NAME || 'reely.space'
const DRY_RUN = process.env.DRY_RUN === '1'

// The ramp. Default to the first real step up from p=none.
const DMARC_POLICY = process.env.DMARC_POLICY || 'quarantine'
const DMARC_PCT = process.env.DMARC_PCT || '25'

if (!TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN before running.')
  process.exit(1)
}
if (!['none', 'quarantine', 'reject'].includes(DMARC_POLICY)) {
  console.error(`DMARC_POLICY must be none|quarantine|reject, got "${DMARC_POLICY}"`)
  process.exit(1)
}

// The CAs Cloudflare may pick from when issuing or renewing a certificate for
// this zone (Universal SSL rotates between them). Sourced from
// developers.cloudflare.com/ssl/reference/certificate-authorities/.
//
// This is the sharp edge of the whole script: CAA is deny-by-default, so a set
// that is missing a CA Cloudflare later picks means renewal fails and the site
// goes dark on TLS — quietly, weeks after this ran. Cloudflare states the list
// is not exhaustive and can change for operational reasons, so re-check that
// page whenever certificates are being reissued.
const CAA_ISSUERS = [
  'letsencrypt.org',
  'pki.goog; cansignhttpexchanges=yes',
  'ssl.com',
  'sectigo.com',
]

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
    const detail = (json.errors || []).map((e) => `${e.code} ${e.message}`).join('; ')
    throw new Error(`${init.method || 'GET'} ${path} → HTTP ${res.status} ${detail}`)
  }
  return json.result
}

/**
 * Rewrite the p= and pct= tags of an existing DMARC record, leaving every
 * other tag (rua, ruf, adkim, …) exactly as the operator left it. Cloudflare's
 * DMARC Management owns the rua address here, so regenerating the record from
 * scratch would drop the reporting that the ramp depends on.
 */
function applyPolicy(existing, policy, pct) {
  const tags = existing
    .replace(/^"|"$/g, '')
    .split(';')
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !/^p=/i.test(t) && !/^pct=/i.test(t))

  const version = tags.shift() // v=DMARC1 must stay first
  const rest = pct === '100' ? tags : [`pct=${pct}`, ...tags]
  return [version, `p=${policy}`, ...rest].join('; ')
}

async function main() {
  const zones = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}`)
  if (!zones.length) throw new Error(`Zone not found: ${ZONE_NAME}`)
  const zoneId = zones[0].id
  console.log(`Zone: ${ZONE_NAME} (${zoneId})${DRY_RUN ? '  [DRY RUN]' : ''}\n`)

  // --- CAA ---
  const existingCaa = await cf(`/zones/${zoneId}/dns_records?type=CAA&per_page=100`)
  const have = new Set(existingCaa.map((r) => `${r.data.tag}:${r.data.value}`))

  for (const tag of ['issue', 'issuewild']) {
    for (const value of CAA_ISSUERS) {
      if (have.has(`${tag}:${value}`)) {
        console.log(`• CAA ${tag} ${value} — already present`)
        continue
      }
      if (DRY_RUN) {
        console.log(`~ CAA ${tag} ${value} — would create`)
        continue
      }
      await cf(`/zones/${zoneId}/dns_records`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'CAA',
          name: ZONE_NAME,
          ttl: 1, // automatic
          data: { flags: 0, tag, value },
          comment: 'reely: restrict issuance to Cloudflare CAs',
        }),
      })
      console.log(`✓ CAA ${tag} ${value}`)
    }
  }

  // --- DMARC ---
  console.log('')
  const dmarcName = `_dmarc.${ZONE_NAME}`
  const txt = await cf(
    `/zones/${zoneId}/dns_records?type=TXT&name=${encodeURIComponent(dmarcName)}`
  )
  const record = txt.find((r) => /v=DMARC1/i.test(r.content))
  if (!record) {
    console.warn(`✗ No DMARC record at ${dmarcName} — nothing to ramp. Create one first.`)
    return
  }

  const current = record.content.replace(/^"|"$/g, '')
  const next = applyPolicy(current, DMARC_POLICY, DMARC_PCT)
  console.log(`  from: ${current}`)
  console.log(`  to:   ${next}`)

  if (current === next) {
    console.log('• DMARC already at target policy')
  } else if (DRY_RUN) {
    console.log('~ DMARC — would update')
  } else {
    await cf(`/zones/${zoneId}/dns_records/${record.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content: next }),
    })
    console.log(`✓ DMARC now p=${DMARC_POLICY}${DMARC_PCT === '100' ? '' : ` pct=${DMARC_PCT}`}`)
  }

  console.log(`
Next step in the ramp: read the aggregate reports in the Cloudflare DMARC
Management dashboard for a couple of weeks, confirm nothing legitimate is
failing, then re-run with DMARC_PCT=100, and later DMARC_POLICY=reject.
Mail for this domain is forwarded via Namecheap, and forwarding breaks SPF
alignment, so watch the forwarded paths specifically before going to reject.`)
}

main().catch((err) => {
  console.error('\nFAILED:', err.message)
  process.exit(1)
})
