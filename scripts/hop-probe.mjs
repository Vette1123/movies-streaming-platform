// Prove a playing stream is never taken from the viewer.
//
// On 2026-10-31 a stream died nine minutes into an episode and Reely moved the
// viewer to Server 1 with no word on screen, then saved that as their choice.
// The rule lives in the seam between this site and the player's own origin, so
// this drives the real page and the real player bundle together, and fails the
// stream at the browser's network layer rather than patching either of them.
//
//   1. A short outage mid-play: the picture keeps running, nothing hops, and the
//      stream reconnects by itself.
//   2. A long outage: the player stays, says so, and hops only when the viewer
//      presses Switch server. That press is saved.
//   3. A stream that never starts: the hop happens, and saves nothing, so the
//      next visit is back on the Reely Player.
//
// Limits: account and ticket are mocked, as in resume-probe. Chromium only, so
// the player's native HLS path (iPhone) is not exercised. About 3 minutes.
//
// Run: pnpm dev, and `pnpm harness` in ../reely-pro-player, then
//      pnpm hop:probe [app-url]
// PLAYER_HARNESS overrides the player URL (default http://localhost:8790).

import {
  openHeadlessChrome,
  requireServer,
  sleep,
} from './lib/headless-chrome.mjs'

const APP = process.argv[2] ?? 'http://localhost:3000'
const PLAYER = process.env.PLAYER_HARNESS ?? 'http://localhost:8790'
const PORT = Number(process.env.HOP_PROBE_PORT) || 9335
const SERIES = 1396
const BY_TITLE = 'reely_stream_source_by_title_v2'
const DEVICE = 'reely_stream_source'

const fail = (message) => {
  console.error(`✗ ${message}`)
  process.exitCode = 1
}
const pass = (message) => console.log(`✓ ${message}`)
const check = (ok, message, detail = '') =>
  ok ? pass(message) : fail(`${message} ${detail}`)

try {
  await requireServer(APP, 'start `pnpm dev` first')
  await requireServer(
    `${PLAYER}/play`,
    'run `pnpm harness` in ../reely-pro-player first'
  )
} catch (error) {
  console.error(`✗ ${error.message}`)
  process.exit(1)
}

/** The network as this stream sees it. */
const network = { streamDown: false, nothingResolves: false }
let tickets = 0

const answer = (path, body) => {
  if (path === '/api/auth/refresh') {
    return {
      success: true,
      token: 'probe',
      expiresAt: Date.now() + 15 * 60_000,
      userId: 'probe',
      pro: true,
      email: 'probe@example.test',
      name: 'Probe',
      prefs: '{}',
    }
  }
  if (path === '/api/pro/ticket') {
    tickets += 1
    const params = new URLSearchParams({
      type: body.type,
      id: String(body.id),
      t: 'probe',
      o: APP,
      start: String(Math.floor(body.start ?? 0)),
      title: body.title,
      season: String(body.season),
      episode: String(body.episode),
    })
    return { success: true, url: `${PLAYER}/play?${params}` }
  }
  return null
}

const SEED = {
  watchedItems: [
    {
      id: SERIES,
      type: 'series',
      title: 'Breaking Bad',
      season: 2,
      episode: 3,
      overview: '',
      backdrop_path: '',
      poster_path: '',
      added_at: '2026-10-01T20:00:00.000Z',
      modified_at: '2026-10-01T21:00:00.000Z',
    },
  ],
  completedItems: [],
  'reely:playback': {
    [`tv:${SERIES}:2:3`]: {
      position_seconds: 100,
      duration_seconds: 2820,
      updated_at: '2026-10-01T21:10:00.000Z',
    },
  },
  reely_profile: {
    email: 'probe@example.test',
    name: 'Probe',
    picture: null,
    pro: true,
    accent: null,
    density: null,
    presets: 0,
  },
}

const browser = await openHeadlessChrome({ port: PORT, label: 'hop-probe' })
const { send, evaluate } = browser

const fulfill = (requestId, reply) =>
  send('Fetch.fulfillRequest', {
    requestId,
    responseCode: reply ? 200 : 404,
    responseHeaders: [{ name: 'content-type', value: 'application/json' }],
    body: Buffer.from(JSON.stringify(reply ?? { success: false })).toString(
      'base64'
    ),
  })

browser.onEvent((msg) => {
  if (msg.method !== 'Fetch.requestPaused') return
  const { requestId, request } = msg.params
  const url = new URL(request.url)
  if (request.url.startsWith(PLAYER)) {
    if (network.nothingResolves) return fulfill(requestId, { sources: [] })
    return send('Fetch.continueRequest', { requestId })
  }
  if (!request.url.startsWith(APP)) {
    if (network.streamDown) {
      return send('Fetch.failRequest', {
        requestId,
        errorReason: 'ConnectionFailed',
      })
    }
    return send('Fetch.continueRequest', { requestId })
  }
  let body = null
  try {
    body = request.postData ? JSON.parse(request.postData) : null
  } catch {}
  fulfill(requestId, answer(url.pathname, body))
})

const waitFor = async (what, read, timeoutMs = 20000) => {
  const end = Date.now() + timeoutMs
  for (;;) {
    const value = await read()
    if (value) return value
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`)
    await sleep(250)
  }
}

const readStore = (key) =>
  evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}) || 'null')`)

const playerFrame = async () => {
  const { result } = await send('Page.getFrameTree')
  const walk = (node) =>
    node.frame.url.startsWith(PLAYER)
      ? node.frame.id
      : (node.childFrames ?? []).map(walk).find(Boolean)
  return walk(result.frameTree) ?? null
}

const inPlayer = async (expression) => {
  const frameId = await playerFrame()
  if (!frameId) return null
  const { result } = await send('Page.createIsolatedWorld', {
    frameId,
    worldName: 'hop-probe',
  })
  return evaluate(expression, result.executionContextId)
}

const position = () =>
  inPlayer(`document.querySelector('video')?.currentTime ?? null`)

/** Enough picture downloaded to outlast the short outage. */
const BUFFERED_PLENTY = `(() => {
  const v = document.querySelector('video')
  const r = v?.buffered
  return !!r?.length && r.end(r.length - 1) - v.currentTime > 25
})()`

const lostScreen = () =>
  inPlayer(`!!document.querySelector('.reely-lost-actions')`)

const incidents = () => evaluate(`window.__incidents ?? []`)

const openAndPlay = async () => {
  await evaluate(`localStorage.removeItem('probe_seeded')`).catch(() => {})
  await send('Page.navigate', { url: `${APP}/tv-shows/${SERIES}` })
  await sleep(1000)
  await waitFor(
    'the hydrated play button',
    () =>
      evaluate(`(() => {
        const b = document.querySelector('button[aria-label*="season"]')
        return !!b && Object.keys(b).some((k) => k.startsWith('__react'))
      })()`),
    120000
  )
  await waitFor('the account refresh', () =>
    evaluate(
      `performance.getEntriesByType('resource').some((e) => e.name.includes('/api/auth/refresh'))`
    )
  )
  await sleep(500)
  await evaluate(
    `document.querySelector('button[aria-label*="season"]').click()`
  )
}

const untilPlaying = async () => {
  const start = await waitFor('a player position', position, 45000)
  await waitFor(
    'the picture to move',
    async () => ((await position()) ?? 0) > start + 2,
    45000
  )
}

try {
  await send('Fetch.enable', {
    patterns: [
      { urlPattern: `${APP}/api/*` },
      { urlPattern: `${PLAYER}/api/stream/resolve*` },
      { urlPattern: '*unified-streaming*' },
    ],
  })
  await send('Page.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `if (location.origin === ${JSON.stringify(APP)}) {
      window.__incidents = []
      window.addEventListener('message', (event) => {
        if (event.data?.kind === 'incident') window.__incidents.push(event.data.step)
      })
      if (!localStorage.getItem('probe_seeded')) {
        localStorage.clear()
        const seed = ${JSON.stringify(SEED)}
        for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, JSON.stringify(value))
        localStorage.setItem('probe_seeded', '1')
        document.cookie = 'reely_account=1; path=/'
      }
    }`,
  })

  console.log('\n1. a short outage while playing')
  await send('Page.navigate', { url: `${APP}/` })
  await sleep(1500)
  await openAndPlay()
  await untilPlaying()
  await waitFor('a full buffer', () => inPlayer(BUFFERED_PLENTY), 45000)
  const before = await position()
  network.streamDown = true
  const seen = []
  for (let i = 0; i < 11; i += 1) {
    await sleep(2000)
    seen.push(await position())
  }
  const during = seen.at(-1)
  check(
    during > before + 15,
    'the picture kept running on what was buffered',
    `${before} -> ${during}`
  )
  check(
    seen.every((t) => t >= before),
    'the position never jumped back during the outage',
    seen.join(', ')
  )
  check(!(await lostScreen()), 'no error on screen')
  network.streamDown = false
  await waitFor(
    'the reconnect',
    async () => (await incidents()).includes('recovered'),
    60000
  )
  const after = await position()
  check(
    (await playerFrame()) !== null,
    'still on the Reely Player after the outage'
  )
  check(
    after >= during,
    'the reconnect held the position',
    `${during} -> ${after}`
  )
  await sleep(3000)
  check((await position()) > after, 'playing again by itself')
  console.log(`incidents: ${(await incidents()).join(', ')}`)
  check((await readStore(BY_TITLE)) === null, 'no server was saved')

  console.log('\n2. a long outage, and the viewer choosing')
  await openAndPlay()
  await untilPlaying()
  const ticketsBefore = tickets
  network.streamDown = true
  await inPlayer(`document.querySelector('video').currentTime = 500`)
  await waitFor('the lost-stream screen', lostScreen, 180000)
  pass('the player asked instead of hopping')
  check((await playerFrame()) !== null, 'still on the Reely Player while lost')
  check(tickets === ticketsBefore, 'no new ticket was minted')
  check((await readStore(BY_TITLE)) === null, 'no server was saved yet')
  check((await incidents()).includes('stuck'), 'Reely heard `stuck`')
  const held = await position()
  check(
    held > 490,
    'a failed reconnect left the position alone',
    `at ${held}, seeked to 500`
  )

  network.streamDown = false
  await inPlayer(
    `document.querySelectorAll('.reely-lost-actions button')[0].click()`
  )
  await waitFor(
    'Try again to resume',
    async () => ((await position()) ?? 0) > held + 2,
    45000
  )
  pass('Try again resumed in place')

  network.streamDown = true
  await inPlayer(`document.querySelector('video').currentTime = 650`)
  await waitFor('the lost-stream screen again', lostScreen, 180000)
  await inPlayer(
    `document.querySelectorAll('.reely-lost-actions button')[1].click()`
  )
  await waitFor(
    'the move off the player',
    async () => (await playerFrame()) === null
  )
  pass('Switch server left the player')
  const chosen = await readStore(BY_TITLE)
  check(
    chosen && Object.keys(chosen).length === 1,
    "the viewer's choice was saved",
    JSON.stringify(chosen)
  )
  network.streamDown = false

  console.log('\n3. a stream that never starts')
  await evaluate(`localStorage.removeItem('probe_seeded')`)
  network.streamDown = true
  network.nothingResolves = true
  await openAndPlay()
  await waitFor(
    'the player frame to come and go',
    async () =>
      (await incidents()).includes('dead_on_boot') &&
      (await playerFrame()) === null,
    45000
  )
  pass('a dead boot hopped')
  check((await readStore(BY_TITLE)) === null, 'the hop saved no title memory')
  check((await readStore(DEVICE)) === null, 'the hop saved no device default')
  network.streamDown = false
  network.nothingResolves = false
  await evaluate(`localStorage.setItem('probe_seeded', '1')`)
  await send('Page.navigate', { url: `${APP}/tv-shows/${SERIES}` })
  await sleep(1000)
  await waitFor(
    'the hydrated play button',
    () =>
      evaluate(`(() => {
        const b = document.querySelector('button[aria-label*="season"]')
        return !!b && Object.keys(b).some((k) => k.startsWith('__react'))
      })()`),
    60000
  )
  await sleep(1000)
  await evaluate(
    `document.querySelector('button[aria-label*="season"]').click()`
  )
  await waitFor('the player on the next visit', playerFrame)
  await untilPlaying()
  pass('the next visit is back on the Reely Player')
} catch (error) {
  fail(error.message)
  const state = await inPlayer(`(() => {
    const v = document.querySelector('video')
    const r = v?.buffered
    return {
      t: v?.currentTime,
      paused: v?.paused,
      ready: v?.readyState,
      error: v?.error?.message,
      buffered: r?.length ? [r.start(0), r.end(r.length - 1)] : [],
      box: document.getElementById('boot-error')?.style.display,
    }
  })()`).catch(() => null)
  console.log(`player state: ${JSON.stringify(state)}`)
  console.log(`incidents: ${(await incidents().catch(() => [])).join(', ')}`)
} finally {
  await browser.close()
}

console.log(process.exitCode ? '\nFAILED' : '\nall hop checks passed')
