#!/usr/bin/env node
/**
 * Reorder the stream slots: `pnpm stream:order 1 5 4 2 3 [--push] [--env <file>]`
 *
 * The list names, for each NEW slot 1..5, the OLD slot that moves there. Every
 * var of a slot travels together (URL, label, query, path templates), so a
 * provider never arrives with another one's query or path. Rewrites the env
 * file in place; `--push` also sets the GitHub secrets the deploy maps
 * (.github/workflows/deploy.yml) and deletes the ones a slot no longer has, so
 * the next deploy builds the same order. Values are never printed: only hosts.
 *
 * Slot order IS the picker order and the rescue order (config/sources.ts):
 * slot 2 is where the one automatic hop after a stall lands. Run
 * `pnpm stream:chain` afterwards; it fails when slot 2 frames slot 1.
 *
 * Limit: the default stays NEXT_PUBLIC_STREAM_DEFAULT_SLOT (slot 1 unless
 * set), so moving slot 1 moves the public default with it.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

import { parseOrder, reorderSlots } from './lib/stream-order.mjs'

const args = process.argv.slice(2)
const envAt = args.indexOf('--env')
const envFile = envAt >= 0 ? args[envAt + 1] : '.env.local'
const numbers = args
  .filter((a, i) => i !== envAt + 1 || envAt < 0)
  .filter((a) => /^\d$/.test(a))
  .map(Number)

const { order, error } = parseOrder(numbers)
if (error) {
  console.error(`✗ ${error}`)
  process.exit(1)
}

const { lines, next, old } = reorderSlots(
  readFileSync(envFile, 'utf8').split(/\r?\n/),
  order
)
writeFileSync(envFile, lines.join('\n'))

const host = (url) => {
  try {
    return new URL(url).host
  } catch {
    return '(empty)'
  }
}
console.log(`stream order written to ${envFile}:`)
order.forEach((from, i) =>
  console.log(`  slot ${i + 1} <- old slot ${from}  ${host(old[from].url)}`)
)

if (args.includes('--push')) {
  for (const [name, value] of next) {
    if (value) {
      execFileSync('gh', ['secret', 'set', name], { input: value })
      console.log(`  set    ${name}`)
      continue
    }
    try {
      execFileSync('gh', ['secret', 'delete', name], { stdio: 'ignore' })
      console.log(`  delete ${name}`)
    } catch {
      // Absent already: nothing to remove.
    }
  }
  console.log('GitHub secrets updated; the next deploy builds this order.')
}
