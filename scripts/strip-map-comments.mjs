#!/usr/bin/env node
// Drops `//# sourceMappingURL=` comments whose .map is not in the export.
//
// The PostHog plugin uploads the maps and deletes them, but in Turbopack's
// debug-id mode it leaves the comments behind, so 23 of 25 homepage chunks
// pointed at a .map that 404s and DevTools warned on every page. PostHog does
// not need the comment: it matches on the debug id the chunk keeps.
//
// Only DANGLING comments go: a local build without the PostHog key keeps its
// maps and its comments, and DevTools still resolves them.
import { access, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const COMMENT = /^[ \t]*\/\/# sourceMappingURL=([^\r\n]*?)[ \t]*(?:\r?\n|$)/gm

/** Relative map URL in the chunk's LAST mapping comment, or null. */
export function mapUrlOf(content) {
  const match = [...content.matchAll(COMMENT)].pop()
  if (!match) return null
  const url = match[1].trim()
  // data: and absolute URLs are not files in out/; leave them alone.
  if (!url || /^(data:|https?:|\/\/)/.test(url)) return null
  return { url, start: match.index, end: match.index + match[0].length }
}

/** `content` without its mapping comment, if `mapExists` says it dangles. */
export function stripIfDangling(content, mapExists) {
  const found = mapUrlOf(content)
  if (!found || mapExists(found.url)) return content
  return content.slice(0, found.start) + content.slice(found.end)
}

async function* jsFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) yield* jsFiles(path)
    else if (/\.[mc]?js$/.test(entry.name)) yield path
  }
}

const exists = (path) =>
  access(path).then(
    () => true,
    () => false
  )

async function main() {
  const root = resolve(process.argv[2] ?? 'out/_next/static')
  let scanned = 0
  let stripped = 0
  for await (const file of jsFiles(root)) {
    scanned++
    const content = await readFile(file, 'utf8')
    const found = mapUrlOf(content)
    if (!found) continue
    const present = await exists(resolve(dirname(file), found.url))
    const next = stripIfDangling(content, () => present)
    if (next === content) continue
    await writeFile(file, next)
    stripped++
  }
  if (scanned === 0) {
    console.error(`strip-map-comments: no JS under ${root} — wrong directory?`)
    process.exit(1)
  }
  console.log(
    `strip-map-comments: ${stripped} dangling comment(s) removed across ${scanned} chunk(s) in ${root}`
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
