// Can the Reely Player play right now? Read-only; spends no free title.
//
//   pnpm relay:canary
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
  RELAY_2_URL,
  RELAY_3_URL,
  RELAY_URL,
  selftestPassed,
  selftestReason,
  vaultRefused,
} from './lib/relay-selftest.mjs'

const SITE = process.env.SITE_URL ?? 'https://www.reely.space'
// The custom domain, not the workers.dev form — this is what production
// mints into every ticket URL since 2026-11-16. Workers.dev stays live as
// the fallback origin; probing the domain is what a visitor does.
const PLAYER = process.env.PLAYER_URL ?? 'https://play.reely.space'
// The two Netlify fronts are walked for every title. The Deno home (relay 3)
// joins only when a single /status probe says it is alive (see
// includeRelay3): the org has been suspended since 2026-11-17, and walking it
// per title spent three doomed walks per run - each a resolve, two vault
// reads and a self-hop - against a 503 page that can only ever say
// "suspended". One cheap probe per run still witnesses the suspension and
// detects the day it lifts, at a third of the requests.
const RELAYS = [
  process.env.RELAY_URL || RELAY_URL,
  process.env.RELAY_2_URL || RELAY_2_URL,
]
let relay3State = 'not probed'
let relay3Ms = 0
async function includeRelay3() {
  const relay3 = process.env.RELAY_3_URL || RELAY_3_URL
  const t0 = Date.now()
  try {
    const res = await fetch(`${relay3}/status`, {
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(15000),
    })
    relay3Ms = Date.now() - t0
    if (res.ok) {
      RELAYS.push(relay3)
      relay3State = 'alive - joined the walks'
    } else {
      relay3State = `${res.status} (suspended?) - walks skipped`
    }
  } catch (error) {
    relay3Ms = Date.now() - t0
    relay3State = `unreachable (${String(error).slice(0, 50)}) - walks skipped`
  }
}
// A current browser string: the WAF challenges empty and frozen user-agents.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36'

/**
 * Long-running, widely carried titles: one vanishing upstream is not an
 * outage. The vault family a title mints to is per-title and stable
 * (surveyed 2026-11-18): bcdn.hakunaymatata.com serves the Netlify egress,
 * bcdnxw.hakunaymatata.com refuses its Range reads (429, no Retry-After) -
 * so exactly ONE title here walks the refusing family (the degradation
 * witness, see vaultRefused) and two prove the byte path on the serving
 * family. Two witnesses would double the feed into a limiter for zero
 * extra signal: both fronts' walks of the same family answer alike.
 */
export const TITLES = [
  { name: 'Fight Club', query: 'ty=movie&id=550' },
  { name: 'The Dark Knight', query: 'ty=movie&id=155' },
  { name: 'Inception', query: 'ty=movie&id=27205' },
]

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
    // Deno's own error page, a proxy, a dead deploy: say what came back.
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
 * A relay that answers non-JSON (Deno's 503 suspension page, a proxy error)
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
  // walk and refused only the byte read (vaultRefused), or the relay home is
  // the suspended Deno org (its 503 page is environmental, never a signal).
  const degradedOnly = misses.every(
    (m) =>
      vaultRefused(m.stages) ||
      String(selftestReason(m.stages)).includes('SUSPENDED')
  )
  return {
    ok: false,
    degradedOnly,
    detail: misses
      .map((m) => `${relayHost(m.relay)}: ${selftestReason(m.stages)}`)
      .join(' | '),
  }
}

async function main() {
  await includeRelay3()
  const layers = [
    { name: 'Site ticket endpoint', ...(await timed(checkTicket)) },
    { name: 'Player shell', ...(await timed(checkPlayer)) },
    { name: 'Player session route', ...(await timed(checkSession)) },
    // Informational, never an alarm: the suspension is environmental, and
    // the row exists so the skipped walks are visible, not silent.
    { name: 'Relay 3 (deno home)', ok: true, ms: relay3Ms, detail: relay3State },
  ]
  // One at a time: three walks at once is how a canary earns a 429.
  const titles = []
  for (const title of TITLES) {
    titles.push({ name: title.name, ...(await timed(() => checkTitle(title))) })
  }
  const { ok, failedTitles, degradedTitles } = verdict(layers, titles)

  const row = (r) =>
    `| ${r.ok ? 'pass' : '**FAIL**'} | ${r.name} | ${r.ms}ms | ${String(r.detail).replaceAll('|', '/').replaceAll('\n', ' ')} |`
  const report = [
    ok
      ? degradedTitles
        ? '## Reely Player: playing (degraded - vault refuses some titles)'
        : '## Reely Player: playing'
      : '## Reely Player: BROKEN',
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
      : `Re-walk one by hand: \`curl -s "${RELAYS[0]}/selftest?ty=movie&id=550&force=1"\`. The provider walk lives in reely-resolver-relay/relay.ts.`,
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
