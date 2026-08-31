// Refresh data/people.json — the people who get a /person/<id> page.
//
// The set used to be whatever TMDB's `person/popular` returned AT BUILD TIME.
// That list moves every day, so every deploy retired some person pages and
// minted others, and `dynamicParams = false` turns a retired one into a hard
// 404 with no fallback. Search Console duly reported person URLs it had already
// indexed as "Not found (404)" — we had told it about them in the sitemap and
// then deleted them, six hours later, without ever linking anything else.
//
// So the set is a committed file now: the build reads it, no TMDB request, no
// churn. This script is the only thing that changes it, it UNIONS rather than
// replaces (a page we have advertised stays advertised), and the diff is
// reviewable before it ships.
//
//   pnpm people:refresh              # union in today's popular list
//   pnpm people:refresh 4866792 …    # …plus these ids by hand
//
// The cap is the asset budget: a static export writes ~10 files per route and
// the ceiling is 20,000 files for the whole site (see CLAUDE.md).
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(root, 'data', 'people.json')

/** 20 people per TMDB page. */
const PAGES = 10

/** ~3,000 files of the 20,000 the site may write. */
const MAX_PEOPLE = 300

const BASE = process.env.NEXT_PUBLIC_TMDB_BASEURL
const TOKEN = process.env.TMDB_HEADER_KEY

const get = async (endpoint) => {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`${endpoint} → ${res.status}`)
  return res.json()
}

/** The four fields the build actually reads. Anything else is dead weight. */
const summary = (person) => ({
  id: person.id,
  name: person.name,
  profile_path: person.profile_path,
  ...(person.known_for_department
    ? { known_for_department: person.known_for_department }
    : {}),
})

// No photo is a page that is mostly empty space — the same rule the service
// applied when it read the popular list directly.
const usable = (person) =>
  Boolean(person?.id && person.name && person.profile_path)

async function main() {
  if (!BASE || !TOKEN) throw new Error('TMDB_HEADER_KEY / base URL missing')

  const existing = JSON.parse(await readFile(FILE, 'utf8').catch(() => '[]'))
  const byId = new Map(existing.map((person) => [person.id, person]))
  const before = byId.size

  const pages = await Promise.allSettled(
    Array.from({ length: PAGES }, (_, index) =>
      get(`person/popular?language=en-US&page=${index + 1}`)
    )
  )
  for (const page of pages) {
    if (page.status !== 'fulfilled') continue
    for (const person of page.value?.results ?? []) {
      if (!usable(person) || byId.has(person.id)) continue
      byId.set(person.id, summary(person))
    }
  }

  // Ids named on the command line: a person page somebody has already indexed
  // or linked, which the popular list no longer carries.
  for (const id of process.argv.slice(2)) {
    if (byId.has(Number(id))) continue
    const person = await get(`person/${id}?language=en-US`).catch(() => null)
    if (!usable(person)) {
      console.warn(`[people] ${id} has no usable page — skipped`)
      continue
    }
    byId.set(person.id, summary(person))
  }

  // Oldest first: the entries already shipped keep their pages, and it is the
  // NEW ones that fall off the end of the cap rather than the indexed ones.
  const people = [...byId.values()].slice(0, MAX_PEOPLE)
  await writeFile(FILE, `${JSON.stringify(people, null, 2)}\n`)
  console.log(
    `[people] ${before} → ${people.length} (${byId.size - before} new, cap ${MAX_PEOPLE})`
  )
}

main().catch((error) => {
  console.error(`[people] ${error.message}`)
  process.exit(1)
})
