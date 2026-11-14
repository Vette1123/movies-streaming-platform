// Removes paid mentions from the README once their paid period is over, so a
// sponsorship ends on time with nobody watching the calendar. Run daily by
// .github/workflows/expire-sponsors.yml; `pnpm sponsors:expire` runs it here.
//
// A mention is wrapped in a dated pair of markers:
//   <!-- sponsor:proxy-seller until=2026-12-13T12:00:00Z -->
//   ...the mention...
//   <!-- /sponsor:proxy-seller -->
// The site's card ends itself in the browser through `until` in
// config/offers.ts; this is the README half of the same rule.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const OPEN = /<!-- sponsor:([a-z0-9-]+) until=(\S+) -->/g

export function stripExpired(text, now) {
  const removed = []
  const kept = []
  let out = text
  for (const [open, id, until] of [...text.matchAll(OPEN)]) {
    const ends = Date.parse(until)
    if (Number.isNaN(ends))
      throw new Error(`sponsor:${id} has an unreadable until=${until}`)
    const close = `<!-- /sponsor:${id} -->`
    const start = out.indexOf(open)
    const end = out.indexOf(close, start)
    if (end === -1)
      throw new Error(`sponsor:${id} is opened but never closed with ${close}`)
    if (now < ends) {
      kept.push({ id, until })
      continue
    }
    // Take the block's trailing newline and one blank line with it, so no gap is left.
    const tail =
      out.slice(end + close.length).match(/^\r?\n(\r?\n)?/)?.[0] ?? ''
    out = out.slice(0, start) + out.slice(end + close.length + tail.length)
    removed.push({ id, until })
  }
  return { text: out, removed, kept }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = new URL('../README.md', import.meta.url)
  const before = readFileSync(file, 'utf8')
  const { text, removed, kept } = stripExpired(before, Date.now())
  for (const k of kept) console.log(`kept    sponsor:${k.id} (ends ${k.until})`)
  for (const r of removed)
    console.log(`removed sponsor:${r.id} (ended ${r.until})`)
  if (removed.length) writeFileSync(file, text)
  console.log(`${removed.length} removed, ${kept.length} still running`)
}
