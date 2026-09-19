#!/usr/bin/env node
/**
 * Disable playback for a title after a copyright notice.
 *
 * This exists because the answer to a notice is time-critical and was otherwise
 * a sequence of hand edits: find the id, guess the exact JSON shape, remember
 * the report reference, remember to record the date. "Expeditious" is the word
 * that decides whether a host keeps its safe harbour, and a process that needs
 * somebody to remember four things at once is not expeditious — it is a process
 * that eventually gets one of them wrong on the day it matters.
 *
 *   pnpm takedown movie 969681 --report 7e170169c822f2f4 --by "Stichting BREIN"
 *   pnpm takedown tv 1399 --report abc123 --by "HBO" --via "Cloudflare"
 *   pnpm takedown --list
 *
 * The title is looked up from TMDB so the entry is human-readable later; pass
 * --title to skip the lookup (or when there are no TMDB credentials to hand).
 * Writing the file is all this does — commit and push, and CI deploys.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(root, 'config', 'blocked-titles.json')

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? undefined : argv[i + 1]
}
const has = (name) => argv.includes(`--${name}`)

const die = (message) => {
  console.error(`\n  takedown: ${message}\n`)
  process.exit(1)
}

const read = async () => JSON.parse(await readFile(FILE, 'utf8'))

if (has('list')) {
  const data = await read()
  const rows = data.titles ?? []
  console.log(`\n  ${rows.length} title(s) with playback disabled:\n`)
  for (const t of rows) {
    console.log(
      `    ${t.type}/${t.id}  ${t.title}` +
        `\n        ${t.reportedOn}  ${t.complainant}  (report ${t.reportId})`
    )
  }
  console.log()
  process.exit(0)
}

const [type, rawId] = argv
if (type !== 'movie' && type !== 'tv') {
  die('first argument must be "movie" or "tv" (or pass --list)')
}
const id = Number(rawId)
if (!Number.isInteger(id) || id <= 0) {
  die(
    `second argument must be a positive TMDB id, got ${JSON.stringify(rawId)}`
  )
}

const reportId = flag('report')
const complainant = flag('by')
if (!reportId) die('--report <id> is required; it is what a reply has to cite')
if (!complainant) die('--by "<who sent it>" is required')

// The duplicate check comes BEFORE the TMDB lookup, on purpose. "Is this
// already handled?" is answerable from a local file, and making it wait on a
// network call means a TMDB outage turns "already blocked, nothing to do" into
// a hard failure on the one day somebody is working through a stack of notices.
const data = await read()
data.titles = data.titles ?? []

const existing = data.titles.find((t) => t.type === type && t.id === id)
if (existing) {
  console.log(
    `\n  already blocked: ${type}/${id} ${existing.title}` +
      `\n  reported ${existing.reportedOn} by ${existing.complainant} (report ${existing.reportId})` +
      `\n  nothing to do.\n`
  )
  process.exit(0)
}

const lookupTitle = async () => {
  const base = process.env.NEXT_PUBLIC_TMDB_BASEURL
  const token = process.env.TMDB_HEADER_KEY
  if (!base || !token) return null
  try {
    const res = await fetch(`${base}${type === 'tv' ? 'tv' : 'movie'}/${id}`, {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.title || json.name || null
  } catch {
    return null
  }
}

// A readable name is worth one request, but it is NOT worth refusing to act:
// the id is what enforcement keys on, and TMDB being unreachable must never be
// the reason a title stayed playable. Fall back to the id and say so.
const title = flag('title') ?? (await lookupTitle()) ?? `TMDB ${type}/${id}`
if (!flag('title') && title === `TMDB ${type}/${id}`) {
  console.warn(
    `\n  warning: could not reach TMDB for a title — recorded as "${title}".` +
      `\n  The block is fully effective; only the label is a placeholder.` +
      `\n  Re-run with --title "<name>" later if you want it readable.`
  )
}

const entry = {
  type,
  id,
  title,
  reportedOn: new Date().toISOString().slice(0, 10),
  reportId,
  complainant,
  ...(flag('via') ? { via: flag('via') } : {}),
}

data.titles.push(entry)
data.titles.sort((a, b) =>
  a.type === b.type ? a.id - b.id : a.type.localeCompare(b.type)
)

await writeFile(FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8')

console.log(
  `\n  blocked ${type}/${id} — ${title}` +
    `\n  report ${reportId} from ${complainant}, recorded ${entry.reportedOn}` +
    `\n  ${data.titles.length} title(s) now blocked.` +
    `\n\n  Playback is refused in two places once this deploys:` +
    `\n    - cloudflare/worker.js declines to mint a ticket (451)` +
    `\n    - the detail heroes mount no player at all` +
    `\n\n  LIMITS: this disables PLAYBACK only. The detail page, its metadata and` +
    `\n  its search listing are untouched, which is deliberate — a notice about a` +
    `\n  stream is not a notice about a synopsis. If a complainant demands the` +
    `\n  page itself, that is a separate decision and this script does not make it.` +
    `\n\n  Not deployed yet: commit and push, then confirm with` +
    `\n    curl -s -o /dev/null -w '%{http_code}' -X POST https://www.reely.space/api/pro/ticket\n`
)
