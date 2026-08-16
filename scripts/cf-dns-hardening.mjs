// DNS hardening for reely.space: CAA records, plus the three records that say
// "this domain never sends email".
//
// reely.space sends no mail. It DOES receive, since 2026-08-16: Cloudflare
// Email Routing forwards support@reely.space to a personal inbox. Receiving
// changes nothing here — SPF, DKIM and DMARC all describe who may send AS this
// domain, and the answer is still nobody. Email Routing forwards under its own
// envelope sender (SRS), so the strict policy below does not touch it.
//
// What DID change: the MX records are Cloudflare's (route1-3.mx.cloudflare.net)
// instead of Namecheap's forwarders, and SPF now includes _spf.mx.cloudflare.net
// instead of the registrar's. The Email Routing wizard rewrites SPF to `~all`
// whenever it runs, so re-run this script after touching Email Routing.
//
// That matters because it removes the usual reason to be careful here. A
// domain that sends real mail has to walk DMARC up slowly (none → quarantine →
// reject), watching aggregate reports at each step, or it starts bouncing its
// own legitimate email. A domain that sends nothing has nothing to bounce, so
// the strictest policy is correct immediately and every softer setting just
// leaves room for someone to spoof the domain.
//
// So the three records below are the end state, not a step:
//   SPF    v=spf1 … -all   — hard-fail anything not the registrar's forwarder
//   DKIM   *._domainkey p= — "no valid signing key exists, for any selector"
//   DMARC  p=reject        — "refuse mail that fails the two above"
//
// If reely.space ever DOES start sending mail (a transactional provider, or
// "send mail as" from Gmail), all three must be updated BEFORE that mail goes
// out or it will be rejected: add the sender to SPF, publish its DKIM key, and
// drop DMARC to p=none until the reports come back clean.
//
// Usage:
//   CLOUDFLARE_API_TOKEN=<token> pnpm dns:harden
//   DRY_RUN=1 CLOUDFLARE_API_TOKEN=<token> pnpm dns:harden      # print, change nothing
//   DMARC_POLICY=none CLOUDFLARE_API_TOKEN=<token> pnpm dns:harden   # back off
//
// Split out from cf-waf-setup.mjs on purpose: that script runs on every CI
// deploy, and this one must not re-assert mail policy behind your back. It
// also needs Zone.DNS: Edit, which the deploy token does not have.

import process from 'node:process'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const TOKEN = process.env.CLOUDFLARE_API_TOKEN
const ZONE_NAME = process.env.CF_ZONE_NAME || 'reely.space'
const DRY_RUN = process.env.DRY_RUN === '1'

// Strictest by default — correct for a domain that sends nothing. Override
// only while standing up a real sender.
const DMARC_POLICY = process.env.DMARC_POLICY || 'reject'
// Percentage of failing mail the policy applies to. Only useful as a dial when
// ramping a sending domain; at reject/100 it is simply omitted from the record.
const DMARC_PCT = process.env.DMARC_PCT || '100'

if (!TOKEN) {
  console.error('Set CLOUDFLARE_API_TOKEN before running.')
  process.exit(1)
}
if (!['none', 'quarantine', 'reject'].includes(DMARC_POLICY)) {
  console.error(
    `DMARC_POLICY must be none|quarantine|reject, got "${DMARC_POLICY}"`
  )
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
    const detail = (json.errors || [])
      .map((e) => `${e.code} ${e.message}`)
      .join('; ')
    throw new Error(
      `${init.method || 'GET'} ${path} → HTTP ${res.status} ${detail}`
    )
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
  const existingCaa = await cf(
    `/zones/${zoneId}/dns_records?type=CAA&per_page=100`
  )
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

  // --- SPF ---
  //
  // Swap the trailing `~all` (softfail: "probably not us, but deliver anyway")
  // for `-all` (hardfail: "not us, drop it"). Softfail is the polite default
  // for a domain that might be sending from somewhere it forgot to list; this
  // one isn't sending at all, so the polite version only helps a spoofer.
  //
  // The `include:` stays whatever it is — Email Routing's own wizard sets it to
  // _spf.mx.cloudflare.net and this script only ever touches the trailing
  // qualifier. That split matters: the wizard resets `-all` to `~all` every
  // time it runs, and this line is what puts it back.
  console.log('')
  const spfRecords = await cf(
    `/zones/${zoneId}/dns_records?type=TXT&per_page=100`
  )
  const spf = spfRecords.find((r) => /^"?v=spf1/i.test(r.content))
  if (!spf) {
    console.warn('✗ No SPF record found — skipping')
  } else {
    const current = spf.content.replace(/^"|"$/g, '')
    const next = current.replace(/[~?+]all\s*$/i, '-all')
    console.log(`  SPF from: ${current}`)
    console.log(`  SPF to:   ${next}`)
    if (current === next) {
      console.log('• SPF already hard-fails')
    } else if (DRY_RUN) {
      console.log('~ SPF — would update')
    } else {
      await cf(`/zones/${zoneId}/dns_records/${spf.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: next }),
      })
      console.log('✓ SPF now ends in -all')
    }
  }

  // --- DKIM ---
  //
  // A wildcard "null" DKIM key. Publishing `p=` with an empty value at
  // *._domainkey is the RFC 6376 way to state that no valid signing key exists
  // for ANY selector on this domain, so a receiver can reject a forged
  // signature immediately instead of failing open on a selector we never
  // created. Delete this the moment a real sender publishes its key.
  console.log('')
  const dkimName = `*._domainkey.${ZONE_NAME}`
  const dkimExisting = await cf(
    `/zones/${zoneId}/dns_records?type=TXT&name=${encodeURIComponent(dkimName)}`
  )
  if (dkimExisting.length) {
    console.log(`• DKIM null policy already present at ${dkimName}`)
  } else if (DRY_RUN) {
    console.log(`~ DKIM null policy at ${dkimName} — would create`)
  } else {
    await cf(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'TXT',
        name: dkimName,
        content: 'v=DKIM1; p=',
        ttl: 1,
        comment: 'reely: no signing key exists for any selector',
      }),
    })
    console.log(`✓ DKIM null policy at ${dkimName}`)
  }

  // --- DMARC ---
  console.log('')
  const dmarcName = `_dmarc.${ZONE_NAME}`
  const txt = await cf(
    `/zones/${zoneId}/dns_records?type=TXT&name=${encodeURIComponent(dmarcName)}`
  )
  const record = txt.find((r) => /v=DMARC1/i.test(r.content))
  if (!record) {
    console.warn(
      `✗ No DMARC record at ${dmarcName} — nothing to ramp. Create one first.`
    )
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
    console.log(
      `✓ DMARC now p=${DMARC_POLICY}${DMARC_PCT === '100' ? '' : ` pct=${DMARC_PCT}`}`
    )
  }

  console.log(`
Done. Nothing further to do — this is the end state, not a step.

In plain terms: reely.space now tells every mail server in the world that it
sends no email, and that anything claiming to come from @reely.space should be
refused. Inbound is unaffected: Email Routing still forwards support@reely.space,
because these three records govern sending, not receiving.

The one thing to remember: if you ever DO set up email on reely.space, update
SPF and DKIM for the new sender and set DMARC_POLICY=none here BEFORE sending
anything, or every message will be rejected.`)
}

main().catch((err) => {
  console.error('\nFAILED:', err.message)
  process.exit(1)
})
