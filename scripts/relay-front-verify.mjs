/**
 * Is the whole relay chain healthy? One command, both fronts, end to end:
 *
 *   node scripts/relay-front-verify.mjs
 *
 * For each CF front (relay.reely.space, relay-b.reely.space — the hosts a
 * browser actually reaches; *.netlify.app is TCP-blocked on some ISPs):
 *   1. /selftest — the relay's own full walk + byte proof, judged the same
 *      way the hourly canary judges it.
 *   2. a SIGNED /resolve with the pairing key from .env.local — proves the
 *      key this front's origin is paired with still answers, and that the
 *      answer's /file URL was host-rewritten to the front the browser will
 *      use (the front worker's one rewrite).
 *   3. a 1KB Range GET on that /file URL — the exact request the video
 *      element spends per buffering window.
 *
 * Keys: RELAY_KEY_RELAY1 / RELAY_KEY_RELAY2 in the site's .env.local (the
 * durable key block; position 3 is the suspended Deno home, no front).
 * Exit 1 on any failure. Pair with `scripts/relay-canary.mjs`: that walks
 * every relay home hourly; this proves both fronts' full request shapes on
 * demand, e.g. after a deploy or a WAF change.
 */
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = readFileSync(join(ROOT, '.env.local'), 'utf8')
const readKey = (name) =>
  env
    .match(new RegExp(`^${name}=(.+)$`, 'm'))?.[1]
    ?.trim()
    .replace(/^['"]|['"]$/g, '')

const FRONTS = [
  {
    url: 'https://relay.reely.space',
    key: readKey('RELAY_KEY_RELAY1'),
    name: 'relay 1',
  },
  {
    url: 'https://relay-b.reely.space',
    key: readKey('RELAY_KEY_RELAY2'),
    name: 'relay 1b',
  },
]
const PROBE = 'ty=movie&id=550' // Fight Club — long-carried; its absence is an outage, not churn

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** DNS flakes (ENOTFOUND bursts) are an ISP artifact, not a verdict. */
async function jfetch(url, opts = {}) {
  let lastErr
  for (let a = 1; a <= 6; a++) {
    try {
      return await (
        await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) })
      ).json()
    } catch (e) {
      lastErr = e
      await sleep(1500 * a)
    }
  }
  throw lastErr
}

let failed = 0
for (const front of FRONTS) {
  const line = (ok, label, detail) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${front.url} ${label}: ${detail}`)
    if (!ok) failed++
  }

  if (!front.key) {
    line(
      false,
      'pairing key',
      `RELAY_KEY missing from .env.local for ${front.name}`
    )
    continue
  }

  // 1. The relay's own end-to-end selftest through the front.
  try {
    const st = await jfetch(`${front.url}/selftest?${PROBE}&force=1`)
    const seg = st.segment?.status ?? st.master?.status
    line(
      st.ok !== false && (seg == null || [200, 206].includes(seg)) && !st.error,
      'selftest',
      `ok=${st.ok !== false} segment=${seg ?? 'n/a'} in ${st.totalMs ?? st.resolvedIn ?? '?'}ms`
    )
  } catch (e) {
    line(false, 'selftest', String(e).slice(0, 140))
    continue
  }

  // 2. A signed resolve: the pairing key answers, and the URL is fronted.
  try {
    const sig = createHmac('sha256', front.key).update(PROBE).digest('hex')
    const rj = await jfetch(`${front.url}/resolve?${PROBE}&sig=${sig}`)
    const fileUrl = rj.sources?.[0]?.url ?? rj.url
    if (!fileUrl) {
      line(false, 'signed resolve', JSON.stringify(rj).slice(0, 140))
      continue
    }
    line(
      fileUrl.startsWith(`${front.url}/`),
      'signed resolve',
      `paired (${front.name} key) -> ${new URL(fileUrl).host}`
    )

    // 3. The byte path a video element spends.
    const res = await fetch(fileUrl, {
      headers: { range: 'bytes=0-1023' },
      signal: AbortSignal.timeout(30000),
    })
    const buf = await res.arrayBuffer()
    line(
      [200, 206].includes(res.status) && buf.byteLength > 0,
      'file range',
      `${res.status}, ${buf.byteLength}B`
    )
  } catch (e) {
    line(false, 'signed resolve', String(e).slice(0, 140))
  }
}

if (failed) {
  console.error(`${failed} front check(s) failed`)
  process.exit(1)
}
console.log('both fronts: selftest, signed resolve and byte path all green')
