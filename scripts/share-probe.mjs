#!/usr/bin/env node
// End-to-end probe of the share cards, against a REAL deployment.
//
//   pnpm share:probe                       # production
//   pnpm share:probe http://localhost:8788 # a local `pnpm preview`
//
// A shared list or profile unfurls through four hops that no unit test crosses:
// D1, the Worker's page rewrite, the Worker's /api/og/card SVG, and wsrv fetching
// that SVG past the WAF. This publishes a real list and a real profile, fetches
// both as a link unfurler does, and asserts on the image that comes back.
//
// Safe to run against production. Everything it writes belongs to one user row no
// Google account can sign in as, and the last step deletes it, even on failure.
import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const BASE = (process.argv[2] ?? 'https://www.reely.space').replace(/\/$/, '')
const TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim()
const ACCOUNT_ID = '90d6fc64545d1c449331032979dcbfb5'
const DATABASE_ID = '3ef0e030-df5b-4852-8fda-bda034b004b7'

const USER_ID = 'share-probe-user'
const LIST_ID = 'share-probe-list'
const SLUG = 'share-probe-zz9'
const HANDLE = 'share-probe-zz9'
const LIST_NAME = 'Share probe list'
const UNFURLER =
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
/** A rendered card with four posters. An empty frame is a fraction of this. */
const MIN_CARD_BYTES = 40_000

const ITEMS = [
  ['Fight Club', 550, '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg'],
  ['The Dark Knight', 155, '/qJ2tW6WMUDux911r6m7haRef0WH.jpg'],
  ['Pulp Fiction', 680, '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg'],
  ['Oppenheimer', 872585, '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg'],
].map(([title, id, poster_path]) => ({ id, type: 'movie', title, poster_path }))

if (!TOKEN) {
  console.error('✘ CLOUDFLARE_API_TOKEN is not set: the probe writes to D1')
  process.exit(1)
}

let failures = 0
const check = (name, pass, detail) => {
  if (!pass) failures += 1
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${detail}`)
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
  if (!json.success) throw new Error(`D1: ${JSON.stringify(json.errors)}`)
  return json.result?.[0]?.results ?? []
}

const cleanUp = async () => {
  await d1('DELETE FROM sync_items WHERE user_id = ?', [USER_ID])
  await d1('DELETE FROM lists WHERE user_id = ?', [USER_ID])
  await d1('DELETE FROM users WHERE id = ?', [USER_ID])
}

const decode = (value) => value.replace(/&amp;/g, '&')

async function checkUnfurl(label, path, wanted) {
  const page = await fetch(`${BASE}${path}`, {
    headers: { 'user-agent': UNFURLER },
    redirect: 'manual',
  })
  const html = await page.text()
  check(`${label} page`, page.status === 200, `${path} → ${page.status}`)
  check(`${label} names itself`, html.includes(wanted), wanted)

  const og = html.match(
    /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/
  )?.[1]
  check(`${label} has og:image`, !!og, og ? 'present' : 'missing')
  if (!og) return

  const url = decode(og)
  check(
    `${label} card goes through wsrv`,
    new URL(url).host === 'wsrv.nl' && url.includes('og'),
    new URL(url).host
  )
  const image = await fetch(url, { headers: { 'user-agent': UNFURLER } })
  const bytes = (await image.arrayBuffer()).byteLength
  const type = image.headers.get('content-type') ?? ''
  check(
    `${label} card renders`,
    image.status === 200 && type.startsWith('image/') && bytes > MIN_CARD_BYTES,
    `${image.status} ${type} ${bytes} bytes`
  )
}

try {
  await cleanUp()
  const now = Date.now()
  await d1(
    `INSERT INTO users (id, google_sub, email, name, created_at, grants, handle, profile_public)
     VALUES (?, ?, ?, ?, ?, 'pro', ?, 1)`,
    [USER_ID, USER_ID, 'share-probe@reely.space', 'Share Probe', now, HANDLE]
  )
  await d1(
    `INSERT INTO lists (id, user_id, name, slug, published, items, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
    [LIST_ID, USER_ID, LIST_NAME, SLUG, JSON.stringify(ITEMS), now, now]
  )
  // A profile's card is built from what its owner rated. Without ratings it
  // keeps the default picture, on purpose, and proves nothing about the card.
  for (const item of ITEMS) {
    await d1(
      `INSERT INTO sync_items (user_id, store, item_key, payload, updated_at)
       VALUES (?, 'reviews', ?, ?, ?)`,
      [USER_ID, String(item.id), JSON.stringify({ ...item, rating: 9 }), now]
    )
  }
  await checkUnfurl('list', `/l/${SLUG}`, LIST_NAME)
  await checkUnfurl('profile', `/u/${HANDLE}`, 'Share Probe')
} finally {
  await cleanUp()
}

const left = await d1('SELECT COUNT(*) AS n FROM users WHERE id = ?', [USER_ID])
check('probe rows deleted', left[0]?.n === 0, `${left[0]?.n} left`)
const gone = await fetch(`${BASE}/l/${SLUG}`, {
  headers: { 'user-agent': UNFURLER },
  redirect: 'manual',
})
check('list is gone after delete', gone.status === 404, `${gone.status}`)

console.log(failures ? `\n✘ ${failures} failed` : '\n✔ all passed')
process.exit(failures ? 1 : 0)
