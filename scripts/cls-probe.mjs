// Layout shifts on a phone: scroll /movies, open the search palette, type.
// Logs every shift (value + the nodes that moved) so a field CLS can be pinned
// to an element. Field CLS (PostHog $web_vitals) is counted across the page's
// whole life, which Lighthouse never exercises.
//
// Run: pnpm dev   then   pnpm cls:probe [url]
import {
  openHeadlessChrome,
  requireServer,
  sleep,
} from './lib/headless-chrome.mjs'

const url = process.argv[2] ?? 'http://localhost:3000/movies'
const PORT = Number(process.env.CLS_PROBE_PORT) || 9334
const WIDTH = 390
const HEIGHT = 844

const results = Array.from({ length: 20 }, (_, i) => ({
  id: 900000 + i,
  title: `Probe Result ${i + 1}`,
  media_type: i % 2 ? 'tv' : 'movie',
  overview: 'A synthetic search result.',
  release_date: '2020-01-01',
  vote_average: 9 - i * 0.1,
  vote_count: 1000,
  backdrop_path: null,
  poster_path: null,
}))
const body = Buffer.from(
  JSON.stringify({ page: 1, results, total_pages: 1, total_results: 20 })
).toString('base64')

await requireServer(url, 'start `pnpm dev` first')
const browser = await openHeadlessChrome({ port: PORT, label: 'cls-probe' })
const { send, evaluate } = browser
browser.onEvent((msg) => {
  if (msg.method !== 'Fetch.requestPaused') return
  // A phone's round trip: the answer lands well after the 500ms that
  // exempts a shift from CLS as "caused by input".
  setTimeout(
    () =>
      send('Fetch.fulfillRequest', {
        requestId: msg.params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }],
        body,
      }),
    700
  )
})
const touch = (type, x, y) =>
  send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
  })
const phase = async (name) => {
  const shifts = await evaluate(
    `(() => { const s = window.__shifts; window.__shifts = []; return s })()`
  )
  const total = shifts.reduce((a, s) => a + s.value, 0)
  console.log(`${name}: ${total.toFixed(4)}`)
  for (const s of shifts) console.log(`   ${s.value.toFixed(4)} ${s.nodes}`)
  return total
}

try {
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
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__shifts = []
new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ value: e.value, nodes: (e.sources || []).map((s) => (s.node && (s.node.nodeName + '.' + String(s.node.className).slice(0, 50))) + ' ' + Math.round(s.previousRect.y) + '->' + Math.round(s.currentRect.y) + ' h' + Math.round(s.previousRect.height) + '->' + Math.round(s.currentRect.height)).join(' | ') }) }).observe({ type: 'layout-shift', buffered: true })`,
  })
  await send('Page.navigate', { url })
  let button
  for (let i = 0; i < 60 && !button; i++) {
    await sleep(500)
    button = await evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find((b) => /Search\.\.\./.test(b.textContent) && b.getBoundingClientRect().width > 0)
      if (!b || !Object.keys(b).some((k) => k.startsWith('__react'))) return null
      const r = b.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })()`)
  }
  if (!button) throw new Error('no hydrated "Search..." button after 30s')
  await sleep(2500)
  const load = await phase('load')

  // Scroll the page by touch, then slowly down the whole listing.
  for (let k = 0; k < 6; k++) {
    await touch('touchStart', 200, 700)
    for (let s = 1; s <= 10; s++) {
      await sleep(16)
      await touch('touchMove', 200, 700 - 50 * s)
    }
    await touch('touchEnd')
    await sleep(700)
  }
  const scroll = await phase('scroll')
  await evaluate('window.scrollTo(0, 0)')
  await sleep(800)
  await phase('back to top')

  await touch('touchStart', button.x, button.y)
  await touch('touchEnd')
  await sleep(1500)
  const open = await phase('open search')

  // Simulate the keyboard: the visual viewport shrinks to ~half.
  await send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: 420,
    deviceScaleFactor: 2,
    mobile: true,
  })
  await sleep(1000)
  const kb = await phase('keyboard up')
  await evaluate(
    `(() => { const i = document.querySelector('[cmdk-input]'); i.focus(); })()`
  )
  for (const ch of 'dune') {
    // 'char' only, no keyDown: an Android soft keyboard composes text and sends
    // no key events, so Chrome does not mark the shifts it causes as input-driven.
    await send('Input.dispatchKeyEvent', { type: 'char', text: ch })
    await sleep(Number(process.env.KEY_MS) || 900)
  }
  const type = await phase('typing')
  console.log(
    `TOTAL load ${load.toFixed(4)} scroll ${scroll.toFixed(4)} open ${open.toFixed(4)} keyboard ${kb.toFixed(4)} typing ${type.toFixed(4)}`
  )
} catch (e) {
  console.error('x ' + e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}
