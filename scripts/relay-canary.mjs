// Can the Reely Player play right now? Read-only; spends no free title.
//
//   pnpm relay:canary
//   pnpm relay:fallback   (relay-b alone - the weekly fallback proof)
//
// The player depends on a provider we do not control. Its gate changed on
// 2026-09-05, 10-08, 10-16, 10-30 and 11-07, and every time the first signal
// was a person pressing play and getting the fallback. This walks the four
// layers in the order a play does and names the first one that broke:
//
//   1. the site's ticket endpoint answers (a bad request, so no trial is spent)
//   2. the private player's shell loads
//   3. the player's session route is alive (a garbage ticket, refused in shape)
//   4. the relay's /selftest walks the provider to a real segment, per title
//
// `.github/workflows/relay-canary.yml` runs it hourly and opens an issue when
// it fails. Exit 1 on failure, with the report on stdout either way.
//
// ponytail: layer 3 proves the session route is alive and refusing garbage in
// its own shape — it cannot prove a GOOD ticket works (that needs a signed-in
// session), and layer 4 proves the relay, not the player's /api/stream/resolve
// pass-through. The player has been a thin pass-through to the relay for every
// outage so far; if that changes, give the canary a supporter session.

import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

import {
  HEALTH_QUERY,
  RELAY_2_URL,
  RELAY_URL,
  TITLES,
  selftestPassed,
  selftestReason,
  vaultRefused,
} from './lib/relay-selftest.mjs'

const SITE = process.env.SITE_URL ?? 'https://www.reely.space'
// The custom domain, not the workers.dev form — this is what production
// mints into every ticket URL since 2026-11-16. Workers.dev stays live as
// the fallback origin; probing the domain is what a visitor does.
const PLAYER = process.env.PLAYER_URL ?? 'https://play.reely.space'
// Two relay homes make the chain: relay 1 on an Oracle Always Free VM behind
// a Cloudflare Tunnel, relay-b on Netlify Edge Functions as the cold fallback
// (since 2026-11-19; the Deno org is gone for good). relay 1 is primary;
// relay-b is the failover the player hops to when relay 1 is cooling or down.
// Both are walked for every title, in that order - the same order the player
// asks them in - but the walk stops at the first usable answer, so a healthy
// relay 1 means relay-b is not touched (exactly what the player does).
const CONFIGURED_RELAYS = [
  process.env.RELAY_URL || RELAY_URL,
  process.env.RELAY_2_URL || RELAY_2_URL,
]
/**
 * `RELAY_ONLY=2` walks the fallback alone - the one thing the hourly run can
 * never prove, because it stops at the primary. The weekly fallback canary
 * (.github/workflows/relay-fallback.yml) sets it: a cold fallback that has
 * rotted is discovered on a Monday, not on the day relay 1 (Netlify) pauses.
 */
const ONLY =
  process.env.RELAY_ONLY?.trim() ||
  (process.argv.includes('--fallback-only') ? '2' : '')
const RELAYS =
  ONLY === '1' || ONLY === '2'
    ? [CONFIGURED_RELAYS[Number(ONLY) - 1]]
    : CONFIGURED_RELAYS
const ONLY_HOME = { 1: 'relay 1', 2: 'relay-b' }[ONLY] ?? null
// A current browser string: the WAF challenges empty and frozen user-agents.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36'

/**
 * Long-running, widely carried titles: one vanishing upstream is not an
 * outage. The list - and which title is the degradation witness - lives in
 * scripts/lib/relay-selftest.mjs, beside the health gate that must never walk
 * that witness (2026-11-25: it did, and every ticket 503'd).
 */
export { TITLES }

// The verdict on one walk is shared with the Worker's /api/stream/health.
export { selftestPassed, selftestReason }

/**
 * The whole verdict. The site and player layers must pass. A title failure
 * pages only when a HARD failure is involved and most titles fail, or when
 * EVERY title fails; vault-egress refusals alone are degradation - witnessed
 * hourly, not paged (lessons 2026-11-18: polling only feeds the limiter, and
 * an outage issue per hour for a partial degradation is alarm fatigue).
 */
export function verdict(layers, titles) {
  const failed = titles.filter((t) => !t.ok)
  const degraded = failed.filter((t) => t.degradedOnly).length
  const titlesOk =
    failed.length === 0 ||
    (degraded === failed.length
      ? failed.length < titles.length
      : failed.length * 2 < titles.length)
  return {
    ok: layers.every((l) => l.ok) && titlesOk,
    failedTitles: failed.length,
    degradedTitles: degraded,
  }
}

async function timed(fn) {
  const t0 = Date.now()
  try {
    return { ...(await fn()), ms: Date.now() - t0 }
  } catch (error) {
    return { ok: false, detail: String(error), ms: Date.now() - t0 }
  }
}

const signal = () => AbortSignal.timeout(60_000)

async function checkTicket() {
  // `{}` fails validation before any session, trial or title check runs.
  const res = await fetch(`${SITE}/api/pro/ticket`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA },
    body: '{}',
    signal: signal(),
  })
  const body = await res.text()
  return {
    ok: res.status === 400 && body.includes('Bad request'),
    detail: `${res.status} ${body.slice(0, 120)}`,
  }
}

async function checkPlayer() {
  const res = await fetch(`${PLAYER}/play`, {
    headers: { 'user-agent': UA },
    signal: signal(),
  })
  const body = await res.text()
  return {
    ok: res.status === 200 && body.includes('id="player"'),
    detail: `${res.status}, ${body.length} bytes`,
  }
}

async function checkSession() {
  // A garbage ticket: the route must be alive enough to refuse it, with its
  // own JSON and its own status. The static shell above can load while the
  // worker's API half is down — a 5xx, an HTML error page or a hang here is
  // exactly that, and no play can boot through it.
  const res = await fetch(
    `${PLAYER}/api/session/start?type=movie&id=550&t=canary-probe`,
    {
      method: 'POST',
      headers: { 'user-agent': UA },
      signal: signal(),
    }
  )
  const body = await res.text()
  return {
    ok: res.status === 403 && body.includes('invalid or expired ticket'),
    detail: `${res.status} ${body.slice(0, 120)}`,
  }
}

async function selftest(relay, query) {
  const res = await fetch(`${relay}/selftest?${query}`, {
    headers: { 'user-agent': UA },
    signal: signal(),
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    // An HTML error page (a paused site, a proxy), a dead deploy: say what
    // came back.
    throw new Error(`/selftest answered ${res.status}: ${text.slice(0, 120)}`)
  }
}

const relayHost = (relay) => new URL(relay).host

/**
 * One title, walked the way a play now walks: every relay in order, first
 * usable answer wins. A cooling 429 moves the player to the next relay
 * rather than holding it, so the canary mirrors that; when no relay carries
 * the title at all, wait out any cooldown once and re-walk the cooling ones
 * before declaring failure — a burst of real viewers must not page anybody.
 *
 * A relay that answers non-JSON (a paused site's HTML page, a proxy error)
 * is a miss on that relay, never an abort: the walk moves to the next one,
 * exactly as the player's askRelays does.
 */
async function checkTitle({ query }) {
  const misses = []
  for (const relay of RELAYS) {
    let stages
    try {
      stages = await selftest(relay, query)
    } catch (error) {
      misses.push({ relay, stages: { error: String(error.message ?? error) } })
      continue
    }
    if (selftestPassed(stages)) {
      return {
        ok: true,
        detail: `${relayHost(relay)}: segment ${stages.segment.bytes} bytes, resolved in ${stages.resolvedIn}`,
      }
    }
    misses.push({ relay, stages })
  }
  const cooling = misses.filter((m) => m.stages.coolingFor)
  if (cooling.length) {
    const wait = Math.min(
      Math.max(...cooling.map((m) => m.stages.coolingFor)) + 5,
      150
    )
    await new Promise((r) => setTimeout(r, wait * 1000))
    for (const { relay } of cooling) {
      let stages
      try {
        stages = await selftest(relay, query)
      } catch (error) {
        stages = { error: String(error.message ?? error) }
      }
      if (selftestPassed(stages)) {
        return {
          ok: true,
          detail: `${relayHost(relay)}: segment ${stages.segment.bytes} bytes, resolved in ${stages.resolvedIn}`,
        }
      }
      const miss = misses.find((m) => m.relay === relay)
      miss.stages = stages
    }
  }
  // A miss is DEGRADATION, not a broken relay, when the vault resolved the
  // walk and refused only the byte read (vaultRefused). Anything else - a
  // paused site's page, a 5xx, a timeout - is a hard failure and pages.
  const degradedOnly = misses.every((m) => vaultRefused(m.stages))
  return {
    ok: false,
    degradedOnly,
    detail: misses
      .map((m) => `${relayHost(m.relay)}: ${selftestReason(m.stages)}`)
      .join(' | '),
  }
}

async function main() {
  const layers = [
    { name: 'Site ticket endpoint', ...(await timed(checkTicket)) },
    { name: 'Player shell', ...(await timed(checkPlayer)) },
    { name: 'Player session route', ...(await timed(checkSession)) },
  ]
  // One at a time: three walks at once is how a canary earns a 429.
  const titles = []
  for (const title of TITLES) {
    titles.push({ name: title.name, ...(await timed(() => checkTitle(title))) })
  }
  const { ok, failedTitles, degradedTitles } = verdict(layers, titles)

  const row = (r) =>
    `| ${r.ok ? 'pass' : '**FAIL**'} | ${r.name} | ${r.ms}ms | ${String(r.detail).replaceAll('|', '/').replaceAll('\n', ' ')} |`
  const scope = ONLY_HOME ? ` (${ONLY_HOME} only)` : ''
  const report = [
    ok
      ? degradedTitles
        ? `## Reely Player: playing${scope} (degraded - vault refuses some titles)`
        : `## Reely Player: playing${scope}`
      : `## Reely Player: BROKEN${scope}`,
    '',
    '| | Check | Time | Detail |',
    '|---|---|---|---|',
    ...layers.map(row),
    ...titles.map(row),
    '',
    `${failedTitles} of ${titles.length} titles failed` +
      (degradedTitles
        ? ` - ${degradedTitles} vault-degraded: the walk resolves and the title is carried, the mbVault CDN only refuses this egress's Range read; witnessed hourly, not an outage (lessons 2026-11-18)`
        : '') +
      '. Pages on hard failures across most titles, or when every title fails.',
    ok
      ? ''
      : `Re-walk one by hand: \`curl -s "${RELAYS[0]}/selftest?${HEALTH_QUERY}&force=1"\`. The provider walk lives in reely-resolver-relay/relay.ts.`,
  ].join('\n')

  console.log(report)
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`)
  }
  if (process.env.REPORT_FILE) fs.writeFileSync(process.env.REPORT_FILE, report)
  process.exit(ok ? 0 : 1)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main()
}
