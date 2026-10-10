// Prove the search palette's results can be scrolled on a phone.
//
// Why this exists. On a phone with the keyboard up, typing a query left the
// results list parked down among the shortcuts: a finger on the open palette
// highlights a row (touch-move selects), cmdk scrolls the highlighted row into
// view on every keystroke, search is async so that row was still a shortcut,
// the results then landed above it and scroll anchoring held the shortcut in
// place. A swipe for the results moved nothing and Enter opened the shortcut.
// Desktop never showed it — a 460px list fits the shortcuts without scrolling —
// which is why it reached production. The fix is in components/command-menu.tsx
// (the selection is controlled; see the comment above `resultsShown`).
//
// What it does: launches headless Chrome over the DevTools protocol (Node's own
// WebSocket, no dependency), emulates a 390x420 touch phone — 420 is what is
// left above a phone keyboard — answers /api/search with 20 synthetic results
// (so no Worker, no TMDB), seeds three recent searches (the state most return
// visitors are in, and the one that triggers it), opens the palette, types, and
// asserts:
//
//   1. the list is at the top once the results are in      (was 2092px down)
//   2. the selected row is the first result, not a shortcut (was "Home")
//   3. a real touch drag scrolls the list                   (was 0 movement)
//
// Limits: Chromium only. It cannot run iOS Safari, which has no scroll
// anchoring, so there the same bug parked the list mid-results instead.
//
// Run: pnpm dev   then   pnpm search:probe [url]
// CHROME_PATH overrides the browser; default is the stock install location.

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const url = process.argv[2] ?? 'http://localhost:3000/movies'
const PORT = Number(process.env.SEARCH_PROBE_PORT) || 9333
const WIDTH = 390
const HEIGHT = 420
const RESULT_COUNT = 20

const DEFAULT_CHROME = {
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: 'google-chrome',
}
const chromePath = process.env.CHROME_PATH ?? DEFAULT_CHROME[process.platform]

const fail = (message) => {
  console.error(`✗ ${message}`)
  process.exitCode = 1
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const results = Array.from({ length: RESULT_COUNT }, (_, i) => ({
  id: 900000 + i,
  title: `Probe Result ${i + 1}`,
  media_type: i % 2 ? 'tv' : 'movie',
  overview:
    'A synthetic search result, two lines long so every row has the real height of one.',
  release_date: '2020-01-01',
  vote_average: 9 - i * 0.1,
  vote_count: 1000,
  backdrop_path: null,
  poster_path: null,
}))
const searchBody = Buffer.from(
  JSON.stringify({
    page: 1,
    results,
    total_pages: 1,
    total_results: RESULT_COUNT,
  })
).toString('base64')

try {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
} catch (error) {
  console.error(
    `✗ ${url} is not answering (${error.message}) — start \`pnpm dev\` first`
  )
  process.exit(1)
}

const profile = mkdtempSync(join(tmpdir(), 'search-probe-'))
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    'about:blank',
  ],
  { stdio: 'ignore' }
)

let ws
try {
  let page
  for (let i = 0; i < 50 && !page; i++) {
    await sleep(200)
    try {
      const targets = await (
        await fetch(`http://127.0.0.1:${PORT}/json`)
      ).json()
      page = targets.find((t) => t.type === 'page')
    } catch {}
  }
  if (!page)
    throw new Error(`Chrome never opened a debugging port at ${chromePath}`)

  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve) => ws.addEventListener('open', resolve))
  let seq = 0
  const pending = new Map()
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++seq
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
    // Answer every /api/search with the synthetic page.
    if (msg.method === 'Fetch.requestPaused') {
      send('Fetch.fulfillRequest', {
        requestId: msg.params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }],
        body: searchBody,
      })
    }
  })
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    const err = r.result?.exceptionDetails
    if (err)
      throw new Error(`in page: ${err.exception?.description ?? err.text}`)
    return r.result?.result?.value
  }
  const touch = (type, x, y) =>
    send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    })

  await send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  })
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/search*' }] })
  await send('Page.enable')
  // Recent searches are what put the first selection somewhere other than the
  // shortcuts — without them cmdk re-selects the same row and never scrolls.
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('reely:recent-searches', '["dune","the bear","severance"]')`,
  })
  await send('Page.navigate', { url })

  // Wait for hydration: the header's search button only works once React owns it.
  let button
  for (let i = 0; i < 60 && !button; i++) {
    await sleep(500)
    button = await evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find((b) => /Search\\.\\.\\./.test(b.textContent) && b.getBoundingClientRect().width > 0)
      if (!b || !Object.keys(b).some((k) => k.startsWith('__react'))) return null
      const r = b.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })()`)
  }
  if (!button)
    throw new Error('no hydrated "Search..." button in the header after 30s')

  await touch('touchStart', button.x, button.y)
  await touch('touchEnd')
  await sleep(1000)
  // Rest a finger on a shortcut, as anybody does who scrolls the open palette
  // before typing: a touch-move selects the row under it, and the row that is
  // selected when the query changes is the one cmdk scrolls into view.
  const shortcut = await evaluate(`(() => {
    const row = [...document.querySelectorAll('[cmdk-item]')].find((i) => i.textContent.trim() === 'Home')
    row.scrollIntoView({ block: 'center' })
    const r = row.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await touch('touchStart', shortcut.x, shortcut.y)
  for (let s = 1; s <= 6; s++) {
    await sleep(16)
    await touch('touchMove', shortcut.x, shortcut.y - 8 * s)
  }
  await touch('touchEnd')
  await sleep(500)
  await evaluate(`document.querySelector('[cmdk-list]').scrollTop = 0`)
  const before = await evaluate(
    `document.querySelector('[cmdk-item][aria-selected="true"]')?.textContent.trim()`
  )
  console.log(`selected before typing: "${before}"`)
  await sleep(300)
  await evaluate(`document.querySelector('[cmdk-input]').focus()`)
  await send('Input.insertText', { text: 'probe' })

  const readList = () =>
    evaluate(`(() => {
      const l = document.querySelector('[cmdk-list]')
      if (!l) return null
      const r = l.getBoundingClientRect()
      const selected = l.querySelector('[cmdk-item][aria-selected="true"]')
      return {
        scrollTop: Math.round(l.scrollTop),
        maxScroll: l.scrollHeight - l.clientHeight,
        top: r.top,
        height: l.clientHeight,
        resultRows: [...l.querySelectorAll('[cmdk-item]')].filter((i) => i.textContent.includes('Probe Result')).length,
        selected: selected ? selected.getAttribute('data-value') : null,
      }
    })()`)

  let list
  for (let i = 0; i < 20; i++) {
    await sleep(250)
    list = await readList()
    if (list?.resultRows === RESULT_COUNT) break
  }
  if (list?.resultRows !== RESULT_COUNT)
    throw new Error(
      `results never rendered (${list?.resultRows ?? 0}/${RESULT_COUNT} rows)`
    )
  await sleep(500) // let cmdk's scheduled selection + scroll settle
  list = await readList()
  console.log(
    `list ${list.height}px tall, ${list.maxScroll}px of scroll, at ${list.scrollTop}px, selected "${list.selected}"`
  )

  if (list.maxScroll < 200)
    fail(
      `list only overflows by ${list.maxScroll}px — viewport is not short enough to test anything`
    )
  if (list.scrollTop > 0)
    fail(
      `results arrived with the list scrolled ${list.scrollTop}px down (of ${list.maxScroll}) — expected 0`
    )
  const first = `${results[0].id}-${results[0].title}`
  if (list.selected !== first)
    fail(
      `selected row is "${list.selected}" — expected the first result, "${first}"`
    )

  // A real finger drag: start low in the list, pull up 200px.
  const x = WIDTH / 2
  const y0 = list.top + list.height - 30
  await touch('touchStart', x, y0)
  for (let s = 1; s <= 12; s++) {
    await sleep(16)
    await touch('touchMove', x, y0 - (200 * s) / 12)
  }
  await touch('touchEnd')
  await sleep(800)
  const after = await readList()
  const moved = after.scrollTop - list.scrollTop
  console.log(`touch drag of 200px moved the list ${moved}px`)
  if (moved < 100) fail(`a 200px touch drag moved the list only ${moved}px`)

  if (!process.exitCode)
    console.log(
      '✓ search results start at the top, first result selected, touch scroll works'
    )
} catch (error) {
  fail(error.message)
} finally {
  ws?.close()
  chrome.kill()
  await sleep(300)
  try {
    rmSync(profile, { recursive: true, force: true })
  } catch {}
}
