// pnpm stream:chain: is the server a stalled viewer is hopped to a different
// provider, or just the dead one in a frame?
//
// Fetches each configured slot's embed page for one movie, lists the hosts it
// frames, and FAILS when the first slot after the default (where the one
// automatic hop after a stall lands) frames an earlier slot. A wrap further
// down the list only warns: a viewer reaches it by choosing, and sees it fail.
// Limit: reads the HTML a plain fetch gets. A page that injects its iframe
// from script is invisible here; the line prints "(own player or script)".

import { embeddedHosts, wrappedSlots } from './lib/stream-chain.mjs'
import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const MOVIE_ID = Number(process.argv[2] ?? 550)
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36'

const env = (name) => process.env[name]?.trim() || ''

const configured = [1, 2, 3, 4, 5]
  .map((slot) => {
    const prefix =
      slot === 1
        ? 'NEXT_PUBLIC_STREAMING_MOVIES_API_URL'
        : `NEXT_PUBLIC_STREAM_SOURCE_${slot}`
    return {
      slot,
      base: env(prefix).replace(/\/$/, ''),
      moviePath: env(`${prefix}_MOVIE_PATH`) || '/movie/{id}',
    }
  })
  .filter((entry) => entry.base)

if (configured.length < 2) {
  console.error(`✗ ${configured.length} stream slot(s) configured; need 2+`)
  process.exit(1)
}

const defaultSlot = Number(env('NEXT_PUBLIC_STREAM_DEFAULT_SLOT') || 1)
const defaultIndex = Math.max(
  0,
  configured.findIndex((entry) => entry.slot === defaultSlot)
)
const rescueSlot = configured[(defaultIndex + 1) % configured.length].slot

async function embedsOf(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,*/*;q=0.8',
        Referer: 'https://www.reely.space/',
      },
      signal: AbortSignal.timeout(15_000),
    })
    return {
      status: response.status,
      embeds: embeddedHosts(await response.text()),
    }
  } catch (error) {
    return { status: error.name, embeds: [] }
  }
}

const slots = await Promise.all(
  configured.map(async (entry) => {
    const url = `${entry.base}${entry.moviePath.replace('{id}', String(MOVIE_ID))}`
    const { status, embeds } = await embedsOf(url)
    return { slot: entry.slot, host: new URL(entry.base).host, status, embeds }
  })
)

for (const entry of slots) {
  const tag = entry.slot === rescueSlot ? ' (stall rescue)' : ''
  const frames = entry.embeds.join(', ') || '(own player or script)'
  console.log(
    `slot ${entry.slot}${tag}: ${entry.host} ${entry.status} → ${frames}`
  )
}

const wraps = wrappedSlots(slots)
for (const { slot, wraps: earlier } of wraps) {
  const mark = slot === rescueSlot ? '✗' : '!'
  console.log(`${mark} slot ${slot} frames slot ${earlier}'s player`)
}

if (wraps.some(({ slot }) => slot === rescueSlot)) {
  console.error(
    `✗ the stall rescue (slot ${rescueSlot}) is not an independent server; reorder the slots`
  )
  process.exit(1)
}
console.log(
  `✓ slot ${rescueSlot}, the stall rescue, is its own provider (${slots.length} slots checked)`
)
