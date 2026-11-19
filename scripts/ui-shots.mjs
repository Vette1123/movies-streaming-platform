#!/usr/bin/env node
/**
 * `pnpm shots [--url https://www.reely.space] [--routes /,/movies] [--out dir] [--phone-width 320]`
 *
 * Phone and desktop screenshots of each route (first screen, full page, and
 * viewport-height slices), plus the one layout check a screenshot can hide:
 * nothing may be wider than the viewport. Exits 1 naming each overflowing
 * element and how far. A list marked `data-one-row` must also keep its items on
 * one line from a 375 px phone up (the hero's rating pills stranded Metascore
 * alone on a second row, 17 Nov). Refuses to grade a Cloudflare challenge page.
 * Limits: Chrome only; layout after interaction (palette, dialogs) is not covered.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { openHeadlessChrome, sleep } from './lib/headless-chrome.mjs'

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const ORIGIN = arg('url', 'https://www.reely.space').replace(/\/$/, '')
const ROUTES = arg(
  'routes',
  '/,/movies,/tv-shows,/movies/27205,/tv-shows/1396,/mood,/support'
).split(',')
const OUT = resolve(arg('out', '.ui-shots'))
const VIEWPORTS = [
  {
    name: 'phone',
    width: Number(arg('phone-width', 390)),
    height: 844,
    mobile: true,
  },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
]

// Runs in the page: every element whose right edge passes the viewport and is
// not inside a horizontally clipping/scrolling ancestor.
const OVERFLOW = `(() => {
  const vw = document.documentElement.clientWidth
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.right <= vw + 1) continue
    let p = el.parentElement, clipped = false
    while (p && p !== document.body) {
      if (getComputedStyle(p).overflowX !== 'visible') { clipped = true; break }
      p = p.parentElement
    }
    if (clipped) continue
    const cls = (el.getAttribute('class') || '').split(/\s+/).slice(0, 3).join('.')
    out.push(el.tagName.toLowerCase() + (cls ? '.' + cls : '') + ' +' + Math.round(r.right - vw) + 'px')
  }
  return JSON.stringify({ scroll: document.documentElement.scrollWidth - vw, items: out.slice(0, 8) })
})()`

// Runs in the page: each visible [data-one-row] list whose items sit on more
// than one line, from 375 px wide up (a 320 px phone may wrap).
const ONE_ROW = `(() => {
  if (document.documentElement.clientWidth < 375) return '[]'
  const out = []
  for (const list of document.querySelectorAll('[data-one-row]')) {
    const items = [...list.children].filter((c) => c.getBoundingClientRect().width > 0)
    const rows = new Set(items.map((c) => Math.round(c.getBoundingClientRect().top)))
    if (rows.size > 1) out.push(list.getAttribute('data-one-row') + ': ' + items.length + ' items on ' + rows.size + ' rows')
  }
  return JSON.stringify(out)
})()`

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const browser = await openHeadlessChrome({
  port: Number(arg('port', 9335)),
  label: 'ui-shots',
})
const { send, evaluate } = browser
const failures = []
try {
  await send('Page.enable')
  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.mobile,
      })
      await send('Emulation.setTouchEmulationEnabled', { enabled: vp.mobile })
      await send('Page.navigate', { url: ORIGIN + route })
      await sleep(6000)
      const title = await evaluate('document.title')
      if (/just a moment|security verification/i.test(title)) {
        throw new Error(`${route}: got a bot challenge, not the page`)
      }
      const slug = `${route.replace(/\W+/g, '_') || '_'}-${vp.name}`
      const shot = async (file, full) => {
        const r = await send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: full,
        })
        writeFileSync(join(OUT, file), Buffer.from(r.result.data, 'base64'))
      }
      await shot(`${slug}.png`, false)
      await shot(`${slug}-full.png`, true)
      // Slices of the viewport's own height, scrolled to (content-visibility
      // sections are not painted off screen, so a clip would capture black).
      const tall = await evaluate('document.documentElement.scrollHeight')
      const screens = Math.min(Math.ceil(tall / vp.height), 8)
      for (let i = 1; i < screens; i++) {
        await evaluate(`window.scrollTo(0, ${i * vp.height})`)
        await sleep(500)
        await shot(`${slug}-s${i}.png`, false)
      }
      await evaluate('window.scrollTo(0, 0)')
      const { scroll, items } = JSON.parse(await evaluate(OVERFLOW))
      const verdict = scroll > 0 ? `OVERFLOW ${scroll}px` : 'fits'
      console.log(`${route.padEnd(22)} ${vp.name.padEnd(8)} ${verdict}`)
      if (scroll > 0) {
        failures.push(`${route} ${vp.name}`)
        for (const item of items) console.log(`    ${item}`)
      }
      for (const wrapped of JSON.parse(await evaluate(ONE_ROW))) {
        console.log(`    WRAPPED ${wrapped}`)
        failures.push(`${route} ${vp.name} (${wrapped})`)
      }
    }
  }
} finally {
  await browser.close()
}
console.log(`shots: ${OUT}`)
if (failures.length) {
  console.error(
    `::error::${failures.length} view(s) scroll sideways or wrap a one-row list: ${failures.join(', ')}`
  )
  process.exit(1)
}
