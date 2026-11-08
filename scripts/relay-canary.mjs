// Can the Reely Player play right now? Read-only; spends no free title.
//
//   pnpm relay:canary
//
// The player depends on a provider we do not control. Its gate changed on
// 2026-09-05, 10-08, 10-16, 10-30 and 11-07, and every time the first signal
// was a person pressing play and getting the fallback. This walks the three
// layers in the order a play does and names the first one that broke:
//
//   1. the site's ticket endpoint answers (a bad request, so no trial is spent)
//   2. the private player's shell loads
//   3. the relay's /selftest walks the provider to a real segment, per title
//
// `.github/workflows/relay-canary.yml` runs it hourly and opens an issue when
// it fails. Exit 1 on failure, with the report on stdout either way.
//
// ponytail: layer 3 proves the relay, not the player's /api/stream/resolve
// (that needs a signed-in ticket). The player has been a thin pass-through to
// the relay for every outage so far; if that changes, give the canary a
// supporter session.

import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const SITE = process.env.SITE_URL ?? 'https://www.reely.space'
const PLAYER =
  process.env.PLAYER_URL ?? 'https://reely-pro-player.boogado66.workers.dev'
const RELAY =
  process.env.RELAY_URL ?? 'https://reely-resolver-relay.reely.deno.net'
// A current browser string: the WAF challenges empty and frozen user-agents.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36'

/** Long-running, widely carried titles: one vanishing upstream is not an outage. */
export const TITLES = [
  { name: 'Fight Club', query: 'ty=movie&id=550' },
  { name: 'Inception', query: 'ty=movie&id=27205' },
  { name: 'Game of Thrones S1E1', query: 'ty=tv&id=1399&s=1&ep=1' },
]

/**
 * A /selftest answer is a pass only when the walk reached a real segment.
 * `ok: true` alone means nothing threw; the segment status is the proof.
 */
export function selftestPassed(stages) {
  return Boolean(
    stages?.ok && stages.master?.isM3U && stages.segment?.status === 200
  )
}

/** Why a /selftest answer failed, in one line. */
export function selftestReason(stages) {
  if (!stages) return 'no answer'
  if (stages.coolingFor) return `rate-limited, cooling ${stages.coolingFor}s`
  if (stages.error) return stages.error
  if (!stages.master?.isM3U) return 'master is not a playlist'
  return `segment ${stages.segment?.status ?? 'missing'}`
}

/**
 * The whole verdict. The site and player layers must pass. Titles fail the run
 * only when most of them fail: a single title can leave the provider's catalog
 * (it happened to 656908) without anything being broken.
 */
export function verdict(layers, titles) {
  const failedTitles = titles.filter((t) => !t.ok).length
  const titlesOk = failedTitles * 2 < titles.length
  return {
    ok: layers.every((l) => l.ok) && titlesOk,
    failedTitles,
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

async function selftest(query) {
  const res = await fetch(`${RELAY}/selftest?${query}`, {
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

async function checkTitle({ query }) {
  let stages = await selftest(query)
  // A 429 cooldown clears itself in about 90s. Wait it out once, so a burst
  // of real viewers does not page anybody; still cooling after that is real.
  if (stages.coolingFor) {
    await new Promise((r) =>
      setTimeout(r, Math.min(stages.coolingFor + 5, 150) * 1000)
    )
    stages = await selftest(query)
  }
  return {
    ok: selftestPassed(stages),
    detail: selftestPassed(stages)
      ? `segment ${stages.segment.bytes} bytes, resolved in ${stages.resolvedIn}`
      : selftestReason(stages),
  }
}

async function main() {
  const layers = [
    { name: 'Site ticket endpoint', ...(await timed(checkTicket)) },
    { name: 'Player shell', ...(await timed(checkPlayer)) },
  ]
  // One at a time: three walks at once is how a canary earns a 429.
  const titles = []
  for (const title of TITLES) {
    titles.push({ name: title.name, ...(await timed(() => checkTitle(title))) })
  }
  const { ok, failedTitles } = verdict(layers, titles)

  const row = (r) =>
    `| ${r.ok ? 'pass' : '**FAIL**'} | ${r.name} | ${r.ms}ms | ${String(r.detail).replaceAll('|', '/').replaceAll('\n', ' ')} |`
  const report = [
    ok ? '## Reely Player: playing' : '## Reely Player: BROKEN',
    '',
    '| | Check | Time | Detail |',
    '|---|---|---|---|',
    ...layers.map(row),
    ...titles.map(row),
    '',
    `${failedTitles} of ${titles.length} titles failed; the run fails when most do.`,
    ok
      ? ''
      : `Re-walk one by hand: \`curl -s "${RELAY}/selftest?ty=movie&id=550&force=1"\`. The provider walk lives in reely-resolver-relay/relay.ts.`,
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
