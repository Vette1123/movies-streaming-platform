#!/usr/bin/env node
// End-to-end probe of the trial refund, against a REAL deployment.
//
//   pnpm trial:probe                 # production, no-stream title 1411621
//   pnpm trial:probe <base> <id>     # another deployment or title
//
// A free visitor's one Reely Player title a day is taken when the ticket is
// minted. A title the provider does not carry must hand it back, and nothing
// else may. That crosses three systems no unit test spans: Reely's Worker and
// D1, the player worker's /api/stream/availability, and the relay's resolve.
//
// Runs signed out, as this machine's address:
//   1. mint a ticket for the no-stream title   -> 200 (spends the trial)
//   2. ask the player about it with that ticket -> stream: false
//   3. ask Reely for the trial back             -> released: true
//   4. mint a ticket for a title that streams   -> 200 (the trial came back)
//   5. ask the player about that one            -> stream: true
//   6. ask for THAT trial back                  -> released: false
// Then deletes the trial row step 4 created, so this address is not left
// holding a title for a day. Needs CLOUDFLARE_API_TOKEN for that cleanup.
// Limit: if this address already spent today's trial on another title, step 1
// answers 402 and the probe stops; it cannot clear a row it did not create.
import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const BASE = (process.argv[2] ?? 'https://www.reely.space').replace(/\/$/, '')
const NO_STREAM_ID = Number(process.argv[3] ?? 1411621)
const STREAMS_ID = 550
const TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim()
const ACCOUNT_ID = '90d6fc64545d1c449331032979dcbfb5'
const DATABASE_ID = '3ef0e030-df5b-4852-8fda-bda034b004b7'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'

let failures = 0
const check = (name, pass, detail) => {
  if (!pass) failures += 1
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`)
  return pass
}

const post = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': UA,
      origin: BASE,
    },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}

const mint = (id) =>
  post('/api/pro/ticket', { type: 'movie', id, title: 'trial probe' })

/** The player's verdict, using the ticket inside the play URL Reely minted. */
async function availability(playUrl, id) {
  const play = new URL(playUrl)
  const ask = new URL('/api/stream/availability', play.origin)
  ask.search = new URLSearchParams({
    type: 'movie',
    id: String(id),
    t: play.searchParams.get('t') ?? '',
  }).toString()
  const res = await fetch(ask, { headers: { 'user-agent': UA } })
  return { status: res.status, data: await res.json().catch(() => null) }
}

async function d1(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  )
  const json = await res.json()
  if (!json.success)
    throw new Error(`D1 ${res.status}: ${JSON.stringify(json.errors)}`)
  return json.result[0]
}

console.log(
  `trial probe → ${BASE}, no-stream title ${NO_STREAM_ID}, streaming title ${STREAMS_ID}`
)
const startedAt = Date.now()
let mintedSecond = false

try {
  const first = await mint(NO_STREAM_ID)
  if (
    !check(
      '1. mint the no-stream title',
      first.status === 200 && typeof first.data?.url === 'string',
      `${first.status} ${first.status === 402 ? '(this address already spent today’s trial on another title; run again tomorrow or from another address)' : ''}`
    )
  ) {
    throw new Error('stop')
  }

  const none = await availability(first.data.url, NO_STREAM_ID)
  check(
    '2. player says the provider has no stream',
    none.status === 200 && none.data?.stream === false,
    `${none.status} ${JSON.stringify(none.data)}`
  )

  const back = await post('/api/pro/trial/release', {
    type: 'movie',
    id: NO_STREAM_ID,
  })
  check(
    '3. Reely hands the trial back',
    back.status === 200 && back.data?.released === true,
    `${back.status} ${JSON.stringify(back.data)}`
  )

  const second = await mint(STREAMS_ID)
  mintedSecond = second.status === 200
  check(
    '4. another title mints: the trial came back',
    mintedSecond && typeof second.data?.url === 'string',
    String(second.status)
  )

  if (mintedSecond) {
    const some = await availability(second.data.url, STREAMS_ID)
    check(
      '5. player says the streaming title streams',
      some.status === 200 && some.data?.stream === true,
      `${some.status} ${JSON.stringify(some.data)}`
    )
    const refused = await post('/api/pro/trial/release', {
      type: 'movie',
      id: STREAMS_ID,
    })
    check(
      '6. a title that streams is never handed back',
      refused.status === 200 && refused.data?.released === false,
      `${refused.status} ${JSON.stringify(refused.data)}`
    )
  }
} catch (error) {
  if (String(error) !== 'Error: stop') check('probe ran', false, String(error))
} finally {
  if (mintedSecond) {
    if (!TOKEN) {
      check(
        'cleanup',
        false,
        'CLOUDFLARE_API_TOKEN unset: this address holds movie:550 for a day'
      )
    } else {
      // Only rows this run created: that title, minted after the probe began.
      const result = await d1(
        'DELETE FROM player_trials WHERE media = ? AND expires_at >= ?',
        [`movie:${STREAMS_ID}`, startedAt + 24 * 60 * 60 * 1000 - 1000]
      )
      check(
        'cleanup',
        true,
        `deleted ${result.meta?.changes ?? '?'} trial row(s) this run created`
      )
    }
  }
}

if (failures > 0) {
  console.error(`\n✘ ${failures} check(s) failed`)
  process.exit(1)
}
console.log('\n✔ a no-stream trial is handed back, and only that one')
