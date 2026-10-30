#!/usr/bin/env node
// End-to-end probe of the Reely Player paywall and the Kodi add-on, against a
// REAL deployment.
//
//   pnpm kodi:probe                        # production
//   pnpm kodi:probe http://localhost:8788  # a local `pnpm preview`
//
// Why this exists rather than a unit test: tests/ticket-access.test.ts proves the
// rule, but not that the deployed Worker runs it, that CI applied the migration,
// or that a stale dashboard var did not reopen the door. The TV half runs the
// add-on's own reely_api.py and hands its stream URL to ffmpeg, so a pass means
// frames decoded through the path a Fire TV takes.
//
// Safe to run against production. It writes two throwaway accounts and trial rows
// on two title ids no real title has, and the last step deletes all of it.
// Needs python and ffmpeg on PATH for the playback half.
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import path from 'node:path'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const BASE = (process.argv[2] ?? 'https://www.reely.space').replace(/\/$/, '')
const TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim()
const ACCOUNT_ID = '90d6fc64545d1c449331032979dcbfb5'
const DATABASE_ID = '3ef0e030-df5b-4852-8fda-bda034b004b7'
const ADDON_DIR = path.resolve('kodi/plugin.video.reely')
const USER_AGENT = 'Reely-Kodi/probe'

const FREE_ID = 'kodi-probe-free'
const PRO_ID = 'kodi-probe-pro'
const FIRST_TITLE = 999999991
const SECOND_TITLE = 999999992
const PROBE_MEDIA = [`movie:${FIRST_TITLE}`, `movie:${SECOND_TITLE}`]

if (!TOKEN) {
  console.error('\n✘ CLOUDFLARE_API_TOKEN is not set — the probe writes D1')
  process.exit(1)
}

let failures = 0

function check(name, ok, detail) {
  console.log(`  ${ok ? '✓' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
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
  if (!json.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(json.errors)}`)
  }
  return json.result?.[0]?.results ?? []
}

const hash = (raw) => createHash('sha256').update(raw).digest('hex')

async function post(route, body, { bearer, cookie } = {}) {
  const res = await fetch(`${BASE}${route}`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      'user-agent': USER_AGENT,
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      ...(cookie ? { cookie: `reely_session=${cookie}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  return { status: res.status, json }
}

const ticket = (id, auth) =>
  post('/api/pro/ticket', { type: 'movie', id, title: 'Probe' }, auth)

async function addAccount(id, grants) {
  await d1(
    'INSERT INTO users (id, google_sub, email, created_at, grants) VALUES (?, ?, ?, ?, ?)',
    [id, id, `${id}@reely.space`, Date.now(), grants]
  )
  const raw = randomBytes(32).toString('hex')
  await d1(
    'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    [hash(raw), id, Date.now(), Date.now() + 3_600_000]
  )
  return raw
}

const deviceCodes = []

async function startLink() {
  const { json } = await post('/api/device/start', {})
  deviceCodes.push(json.deviceCode)
  return json
}

async function cleanup() {
  for (const id of [FREE_ID, PRO_ID]) {
    await d1('DELETE FROM player_trials WHERE subject = ?', [`user:${id}`])
    await d1('DELETE FROM device_links WHERE user_id = ?', [id])
    await d1('DELETE FROM sessions WHERE user_id = ?', [id])
    await d1('DELETE FROM users WHERE id = ?', [id])
  }
  for (const media of PROBE_MEDIA) {
    await d1('DELETE FROM player_trials WHERE media = ?', [media])
  }
  for (const code of deviceCodes) {
    await d1('DELETE FROM device_links WHERE device_hash = ?', [hash(code)])
  }
}

/** The add-on's own code asking for a stream, exactly as play() does. */
function addonStreamUrl(token, target) {
  const script = `
import json, sys
sys.path.insert(0, sys.argv[1])
import reely_api
print(reely_api.stream_url(*json.loads(sys.argv[2])))
`
  return execFileSync(
    'python',
    ['-c', script, ADDON_DIR, JSON.stringify([token, ...target])],
    {
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    }
  ).trim()
}

function decodes(url) {
  try {
    execFileSync(
      'ffmpeg',
      ['-v', 'error', '-t', '4', '-i', url, '-f', 'null', '-'],
      { stdio: 'pipe', timeout: 90_000 }
    )
    return true
  } catch (error) {
    console.log(String(error.stderr ?? error.message).slice(0, 300))
    return false
  }
}

console.log(`\nKodi + Reely Player probe → ${BASE}\n`)

await cleanup()

try {
  const free = await addAccount(FREE_ID, null)
  const pro = await addAccount(PRO_ID, 'pro')

  console.log('signed out')
  {
    const first = await ticket(FIRST_TITLE)
    // A real trial from this address outranks the probe, and is not to be burned.
    if (first.status === 402) {
      console.log('  - skipped: this address already spent its title today')
    } else {
      check(
        'the first title is allowed',
        first.status === 200,
        `HTTP ${first.status}`
      )
      const again = await ticket(FIRST_TITLE)
      check(
        'the same title stays open',
        again.status === 200,
        `HTTP ${again.status}`
      )
      const second = await ticket(SECOND_TITLE)
      check(
        'a second title is refused',
        second.status === 402,
        `HTTP ${second.status}`
      )
    }
  }

  console.log('\nfree account')
  {
    const first = await ticket(FIRST_TITLE, { cookie: free })
    check(
      'the first title is allowed',
      first.status === 200,
      `HTTP ${first.status}`
    )
    const second = await ticket(SECOND_TITLE, { cookie: free })
    check(
      'a second title is refused',
      second.status === 402,
      `HTTP ${second.status}`
    )
    const held = await d1('SELECT media FROM player_trials WHERE subject = ?', [
      `user:${FREE_ID}`,
    ])
    check('the trial is held in D1', held[0]?.media === PROBE_MEDIA[0])
  }

  console.log('\nsupporter on the web')
  {
    const first = await ticket(FIRST_TITLE, { cookie: pro })
    const second = await ticket(SECOND_TITLE, { cookie: pro })
    check(
      'every title is allowed',
      first.status === 200 && second.status === 200,
      `HTTP ${first.status}, ${second.status}`
    )
    const held = await d1('SELECT media FROM player_trials WHERE subject = ?', [
      `user:${PRO_ID}`,
    ])
    check('no trial is spent', held.length === 0)
  }

  console.log('\nlinking a TV')
  let token
  {
    const { deviceCode, userCode, verifyUrl } = await startLink()
    check('a code is issued', Boolean(userCode), verifyUrl)
    const pending = await post('/api/device/poll', { deviceCode })
    check('it pends', pending.json.status === 'pending')

    const anon = await post('/api/device/approve', { code: userCode })
    check(
      'signed out cannot approve',
      anon.status === 401,
      `HTTP ${anon.status}`
    )
    const refused = await post(
      '/api/device/approve',
      { code: userCode },
      { cookie: free }
    )
    check(
      'a free account cannot approve',
      refused.status === 402,
      `HTTP ${refused.status}`
    )
    const approved = await post(
      '/api/device/approve',
      { code: userCode },
      { cookie: pro }
    )
    check(
      'a supporter approves',
      approved.status === 200,
      `HTTP ${approved.status}`
    )

    const collected = await post('/api/device/poll', { deviceCode })
    token = collected.json.token
    check('the TV collects a token', Boolean(token))
    const replay = await post('/api/device/poll', { deviceCode })
    check(
      'it cannot be collected twice',
      replay.status === 410,
      `HTTP ${replay.status}`
    )
  }

  console.log('\nplaying on the TV (the add-on, then ffmpeg)')
  for (const [label, target] of [
    ['a movie', ['movie', 550, 'Fight Club']],
    ['an episode', ['tv', 1399, 'Game of Thrones', 1, 1]],
  ]) {
    const url = addonStreamUrl(token, target)
    check(`${label} resolves`, url.startsWith('http'))
    check(`${label} decodes`, decodes(url))
  }

  console.log('\na TV that should not play')
  {
    const bad = await ticket(FIRST_TITLE, { bearer: 'not-a-session' })
    check(
      'an unknown token is refused',
      bad.status === 401,
      `HTTP ${bad.status}`
    )

    await d1('UPDATE users SET grants = NULL WHERE id = ?', [PRO_ID])
    const lapsed = await ticket(FIRST_TITLE, { bearer: token })
    check(
      'a lapsed supporter stops',
      lapsed.status === 402,
      `HTTP ${lapsed.status}`
    )
    await d1("UPDATE users SET grants = 'pro' WHERE id = ?", [PRO_ID])
    const back = await ticket(FIRST_TITLE, { bearer: token })
    check('and resumes on renewal', back.status === 200, `HTTP ${back.status}`)

    await d1('DELETE FROM sessions WHERE user_id = ?', [PRO_ID])
    const out = await ticket(FIRST_TITLE, { bearer: token })
    check(
      'sign out everywhere stops the TV',
      out.status === 401,
      `HTTP ${out.status}`
    )
  }
} catch (error) {
  check('the probe ran to the end', false, error.message)
}

console.log('\ncleanup')
await cleanup()
{
  const left = await d1('SELECT count(*) AS n FROM users WHERE id IN (?, ?)', [
    FREE_ID,
    PRO_ID,
  ])
  check('the probe accounts are gone', left[0]?.n === 0)
  const trials = await d1(
    'SELECT count(*) AS n FROM player_trials WHERE media IN (?, ?)',
    PROBE_MEDIA
  )
  check('the probe trials are gone', trials[0]?.n === 0)
}

console.log(
  failures === 0
    ? '\n✓ paywall and add-on healthy — trial, supporter, linking, playback, lapse\n'
    : `\n✘ ${failures} check(s) failed\n`
)
process.exit(failures === 0 ? 0 : 1)
