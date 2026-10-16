// Prove "continue watching" and playback preferences survive the round trip.
//
// Why this exists. A show you were part-way through opened on S01E01 from the
// homepage row; an episode watched to the credits was never counted as watched;
// a subtitle language or quality picked IN the player was gone by the next
// episode; and the settings gear restarted the episode on the old subtitles.
// All of it lives in the seam between this site, the Worker's ticket and the
// player's own origin, which no unit test reaches — so this drives the real
// page and the real player bundle together.
//
// What it does: headless Chrome (scripts/lib/headless-chrome.mjs) opens a
// series page with a seeded history (last played S02E03, ten minutes in) and a
// STALE device mirror of the prefs (Arabic, 480p) under an account that says
// French, 720p. The Worker is answered here — sign-in refresh, ticket, account
// save — and the ticket points at the player harness, so the real player boots
// against a public test stream. It asserts:
//
//   1. the hero offers "Resume S2 · E3", not S1 · E1
//   2. hovering Play starts the player's stream lookup for S2E3 before the
//      tap, and the tap spends that hover's ticket instead of minting another;
//      the ticket asks for S2E3 at 600s with the ACCOUNT's prefs (fr, 720)
//   3. the player boots pinned at or under 720p and fetches French subtitles
//   4. a quality and a subtitle picked in the player's menus are saved
//   5. watching past the credits ticks S2E3 off, and the page then offers E4
//
// Limits: the account and ticket are mocked here, so the Worker's own param
// building is not exercised (bmc/seo probes cover production); Chromium only.
//
// Run: pnpm dev, and `pnpm harness` in ../reely-pro-player, then
//      pnpm resume:probe [app-url]
// PLAYER_HARNESS overrides the player URL (default http://localhost:8790).

import {
  openHeadlessChrome,
  requireServer,
  sleep,
} from './lib/headless-chrome.mjs'

const APP = process.argv[2] ?? 'http://localhost:3000'
const PLAYER = process.env.PLAYER_HARNESS ?? 'http://localhost:8790'
const PORT = Number(process.env.RESUME_PROBE_PORT) || 9334
// Breaking Bad: season 2 has 13 episodes, so E3 -> E4 stays in-season.
const SERIES = 1396

const fail = (message) => {
  console.error(`✗ ${message}`)
  process.exitCode = 1
}
const pass = (message) => console.log(`✓ ${message}`)

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

// The Worker, as far as this page needs one. Stateful on purpose: the account
// answers with whatever was last saved, like the real one.
let accountPlayback = { sub: 'fr', quality: 720 }
const tickets = []
const saves = []

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
      prefs: JSON.stringify({ playback: accountPlayback }),
    }
  }
  if (path === '/api/pro/ticket') {
    tickets.push(body)
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
    // The same three the Worker passes through (cloudflare/worker.js).
    if (body.playback?.sub) params.set('sub', body.playback.sub)
    if (body.playback?.subSize) params.set('subs', body.playback.subSize)
    if (body.playback?.quality) params.set('q', String(body.playback.quality))
    return { success: true, url: `${PLAYER}/play?${params}` }
  }
  if (path === '/api/account') {
    saves.push(body)
    if (body?.prefs?.playback) accountPlayback = body.prefs.playback
    return { success: true }
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
      position_seconds: 600,
      duration_seconds: 2820,
      updated_at: '2026-10-01T21:10:00.000Z',
    },
  },
  // The stale device copy the account must win over.
  reely_playback_prefs: { sub: 'ar', quality: 480 },
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

const browser = await openHeadlessChrome({ port: PORT, label: 'resume-probe' })
const { send, evaluate } = browser

browser.onEvent((msg) => {
  if (msg.method !== 'Fetch.requestPaused') return
  const { requestId, request } = msg.params
  let body = null
  try {
    body = request.postData ? JSON.parse(request.postData) : null
  } catch {}
  const reply = answer(new URL(request.url).pathname, body)
  send('Fetch.fulfillRequest', {
    requestId,
    responseCode: reply ? 200 : 404,
    responseHeaders: [{ name: 'content-type', value: 'application/json' }],
    body: Buffer.from(JSON.stringify(reply ?? { success: false })).toString(
      'base64'
    ),
  })
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

const heroCaption = () =>
  evaluate(`(() => {
    const b = document.querySelector('button[aria-label*="season"]')
    if (!b || !Object.keys(b).some((k) => k.startsWith('__react'))) return null
    return b.getAttribute('aria-label')
  })()`)

const readStore = (key) =>
  evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(key)}) || 'null')`)

try {
  await send('Fetch.enable', { patterns: [{ urlPattern: `${APP}/api/*` }] })
  await send('Page.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `if (location.origin === ${JSON.stringify(APP)} && !localStorage.getItem('probe_seeded')) {
      const seed = ${JSON.stringify(SEED)}
      for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, JSON.stringify(value))
      localStorage.setItem('probe_seeded', '1')
      document.cookie = 'reely_account=1; path=/'
    }`,
  })
  await send('Page.navigate', { url: `${APP}/tv-shows/${SERIES}` })

  // 1. The hero's play button names what it will start.
  const label = await waitFor('the hydrated play button', heroCaption, 120000)
  console.log(`play button: "${label}"`)
  if (!/Resume .*season 2 episode 3/.test(label))
    fail(`play button should resume S2E3, says "${label}"`)
  else pass('hero resumes S2 · E3')

  // The account refresh has to land before the ticket, or this is testing the
  // mirror. The header fires it on mount.
  await waitFor('the account refresh', () =>
    evaluate(
      `!!document.querySelector('button[aria-label*="season"]') && performance.getEntriesByType('resource').some((e) => e.name.includes('/api/auth/refresh'))`
    )
  )
  await sleep(500)

  // 2a. Intent: hovering Play mints the ticket AND starts the player's stream
  // lookup, so the relay is walking (or done) before the tap.
  const box = await evaluate(`(() => {
    const r = document.querySelector('button[aria-label*="season"]').getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...box })
  const prewalk = await waitFor('the stream lookup on hover', () =>
    evaluate(
      `performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.startsWith(${JSON.stringify(`${PLAYER}/api/stream/resolve`)})) ?? null`
    )
  ).catch((error) => fail(error.message))
  if (prewalk && /season=2&episode=3/.test(prewalk))
    pass('hovering Play started the stream lookup for S2E3')
  else if (prewalk) fail(`hover looked up the wrong episode: ${prewalk}`)

  await evaluate(
    `document.querySelector('button[aria-label*="season"]').click()`
  )

  // 2. The ticket.
  const ticket = await waitFor('a ticket request', () => tickets[0])
  console.log(`ticket: ${JSON.stringify(ticket)}`)
  if (ticket.season !== 2 || ticket.episode !== 3)
    fail(`ticket asked for S${ticket.season}E${ticket.episode}, expected S2E3`)
  else pass('ticket is for S2E3')
  if (ticket.start !== 600) fail(`ticket start ${ticket.start}, expected 600`)
  else pass('ticket resumes at 600s')
  if (tickets.length !== 1)
    fail(`${tickets.length} tickets minted; the tap should spend the hover's`)
  else pass("the tap spent the hover's ticket")
  if (ticket.playback?.sub !== 'fr' || ticket.playback?.quality !== 720)
    fail(
      `ticket prefs ${JSON.stringify(ticket.playback)} — expected the account's fr/720 over the stale ar/480 mirror`
    )
  else pass("ticket carries the account's prefs over the stale mirror")

  // 3. Into the player's frame. Same site (localhost), so one process and an
  // isolated world on the frame is enough to read and click its DOM.
  const frameId = await waitFor('the player frame', async () => {
    const { result } = await send('Page.getFrameTree')
    const walk = (node) =>
      node.frame.url.startsWith(PLAYER)
        ? node.frame.id
        : (node.childFrames ?? []).map(walk).find(Boolean)
    return walk(result.frameTree)
  })
  const inPlayer = async (expression) => {
    const { result } = await send('Page.createIsolatedWorld', {
      frameId,
      worldName: 'resume-probe',
    })
    return evaluate(expression, result.executionContextId)
  }

  const chip = await waitFor(
    'the quality chip to leave Auto',
    () =>
      inPlayer(`(() => {
        const t = document.querySelector('.art-control-quality')?.textContent?.trim()
        return t && t !== 'Auto' ? t : null
      })()`),
    30000
  )
  if (!/^\d+p$/.test(chip) || Number.parseInt(chip) > 720)
    fail(`player booted at "${chip}", expected a pinned rung at or under 720p`)
  else pass(`player booted pinned at ${chip} (saved 720p)`)

  const french = await waitFor('the French subtitle fetch', () =>
    inPlayer(
      `performance.getEntriesByType('resource').some((e) => e.name.includes('subtitles.vtt') && e.name.includes('lang=fr'))`
    )
  )
  if (french) pass('player fetched the saved French subtitles')

  // 4. Picks in the player's own menus are saved.
  const pickRow = (control, match) =>
    inPlayer(`(async () => {
      document.querySelector('.art-control-${control}').click()
      await new Promise((r) => setTimeout(r, 300))
      const rows = [...document.querySelectorAll('.reely-menu button')]
      const row = rows.find((b) => ${match})
      if (!row) return 'rows: ' + rows.map((b) => b.dataset.key + '=' + b.textContent.trim()).join(', ')
      row.click()
      return 'picked ' + row.textContent.trim()
    })()`)

  const qualityPick = await pickRow(
    'quality',
    `b.dataset.key.startsWith('level:') && !b.textContent.includes(${JSON.stringify(chip)})`
  )
  console.log(`quality menu: ${qualityPick}`)
  const pickedRung = Number.parseInt(qualityPick.replace('picked ', ''))
  const savedQuality = await waitFor('the saved quality', async () => {
    const prefs = await readStore('reely_playback_prefs')
    return prefs?.quality === pickedRung ? prefs.quality : null
  }).catch((error) => fail(error.message))
  if (savedQuality)
    pass(`quality ${pickedRung}p picked in the player was saved`)
  if (!saves.some((s) => s.prefs?.playback?.quality === pickedRung))
    fail('the quality pick never reached the account')
  else pass('…and synced to the account')

  const subPick = await pickRow('cc-picker', `b.dataset.key === 'ext:en'`)
  console.log(`subtitle menu: ${subPick}`)
  const savedSub = await waitFor('the saved subtitle', async () => {
    const prefs = await readStore('reely_playback_prefs')
    return prefs?.sub === 'en' ? prefs.sub : null
  }).catch((error) => fail(error.message))
  if (savedSub) pass('subtitle picked in the player was saved')

  // 5. Past the credits.
  await inPlayer(`(async () => {
    const v = document.querySelector('video')
    for (let i = 0; i < 40 && !(v.duration > 0); i++) await new Promise((r) => setTimeout(r, 250))
    v.currentTime = v.duration * 0.97
    await new Promise((r) => setTimeout(r, 1500))
    v.pause()
  })()`)
  const ticked = await waitFor(
    'S2E3 to be ticked off',
    async () => {
      const done = (await readStore('completedItems')) ?? []
      return done.some(
        (i) => i.id === SERIES && i.season === 2 && i.episode === 3
      )
    },
    15000
  ).catch((error) => fail(error.message))
  if (ticked) pass('watching past the credits ticked S2E3 off')

  // Reloaded on the tab's own URL, which still names S2E3: the play button
  // mirrored it there. A finished episode must not come back.
  await send('Page.reload')
  let next = await waitFor('the hero after reload', heroCaption, 60000)
  await waitFor(
    'the hero to offer S2E4',
    async () => /season 2 episode 4/.test((next = await heroCaption())),
    15000
  ).catch(() => {})
  console.log(`after reload: "${next}"`)
  if (!/season 2 episode 4/.test(next))
    fail(`after finishing S2E3 the hero should offer S2E4, says "${next}"`)
  else pass('the page now offers S2 · E4')

  if (!process.exitCode) console.log('✓ resume and playback prefs round-trip')
} catch (error) {
  fail(error.message)
} finally {
  await browser.close()
}
