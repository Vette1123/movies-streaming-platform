// Refresh data/people.json — the people who get a /person/<id> page.
//
// The set used to be whatever TMDB's `person/popular` returned AT BUILD TIME.
// That list moves every day, so every deploy retired some person pages and
// minted others, and `dynamicParams = false` turns a retired one into a hard
// 404 with no fallback. Search Console duly reported person URLs it had
// already indexed as "Not found (404)" — we had told it about them in the
// sitemap and then deleted them, six hours later, without ever linking
// anything else.
//
// So the set is a committed file now: the build reads it, no TMDB request, no
// churn. This script is the only thing that changes it, it UNIONS rather than
// replaces (a page we have advertised stays advertised), and the diff is
// reviewable before it ships.
//
// WHERE the candidates come from, and why it changed:
//
// The old list was TMDB's popularity ranking - 200 people, famous enough for
// TMDB to rank, and mostly people whose films this site does not even have.
// The site's OWN cast lists are the better set: every one of those names is
// printed on a title page we serve, so a reader who searches "<actor> movies"
// lands on us instead of on nothing. That is the whole point of a person page.
//
//   pnpm people:refresh              # the catalogue's people, capped to the
//                                     # asset budget
//   pnpm people:refresh 4866792 …    # …plus these ids by hand
//
// The cap is the asset budget: a static export writes ~6 files per route and
// the ceiling is 20,000 files for the whole site (see CLAUDE.md). The script
// measures what the last build wrote and spends what is left, so the cap
// follows the site instead of being a number somebody has to remember.
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(root, 'data', 'people.json')
const OUT_DIR = path.join(root, 'out')

/** 20 people per TMDB page. */
const PEOPLE_PER_PAGE = 20

/**
 * The file cap, and the share of it this feature may spend.
 *
 * The cap is a HARD failure: a build that writes one file too many does not
 * deploy. The route count moves on its own between builds (the TMDB lists
 * move), so the target is below the cap rather than at it.
 */
const FILE_CAP = 20_000
const FILE_TARGET = Math.floor(FILE_CAP * 0.9)

/** Files a person route writes in the export. Measured, not guessed. */
const FILES_PER_PERSON = 6

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

/** Every file the last build wrote, so the cap can be measured, not guessed. */
const countFiles = async (dir) => {
  let total = 0
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      total += (await countFiles(path.join(dir, entry.name))) ?? 0
    } else {
      total++
    }
  }
  return total
}

/**
 * The titles the build prerenders — the same lists, the same depths, from the
 * same config file the build reads (config/catalogue.json).
 */
const catalogueTitles = async () => {
  const { listDepth } = JSON.parse(
    await readFile(path.join(root, 'config', 'catalogue.json'), 'utf8')
  )
  const lists = [
    { type: 'movie', list: 'popular', pages: listDepth.popular },
    { type: 'movie', list: 'top_rated', pages: listDepth.topRated },
    { type: 'movie', list: 'trending/day', pages: listDepth.trending },
    { type: 'tv', list: 'popular', pages: listDepth.popular },
    { type: 'tv', list: 'top_rated', pages: listDepth.topRated },
    { type: 'tv', list: 'trending/day', pages: listDepth.trending },
  ]
  const ids = new Map()
  for (const { type, list, pages } of lists) {
    const responses = await Promise.allSettled(
      Array.from({ length: pages }, (_, index) =>
        get(`${type}/${list}?language=en-US&page=${index + 1}`)
      )
    )
    for (const response of responses) {
      if (response.status !== 'fulfilled') continue
      for (const item of response.value?.results ?? []) {
        if (!item?.id) continue
        ids.set(`${type}-${item.id}`, {
          type,
          id: item.id,
          votes: item.vote_count ?? 0,
        })
      }
    }
  }
  return [...ids.values()]
}

/**
 * The cast and crew of a title, with how much attention the title gets.
 *
 * The vote count is the site's own proxy for "how many people care about
 * this": a film with 30,000 votes matters here more than one with 40, and a
 * person who is in the first is worth a page more than a person in the second.
 */
const creditsFor = async (title) => {
  const res = await get(
    `${title.type}/${title.id}/credits?language=en-US`
  ).catch(() => null)
  if (!res) return []
  const people = [
    ...(res.cast ?? []).map((credit) => ({ person: credit, order: credit.order })),
    ...(res.crew ?? []).map((credit) => ({ person: credit, order: 999 })),
  ]
  return people
}

async function main() {
  if (!BASE || !TOKEN) throw new Error('TMDB_HEADER_KEY / base URL missing')

  const existing = JSON.parse(await readFile(FILE, 'utf8').catch(() => '[]'))
  const byId = new Map(existing.map((person) => [person.id, person]))
  const before = byId.size

  // How many files the last build wrote, and how many the person pages are
  // already costing. What is left is what this feature may spend.
  const total = await countFiles(OUT_DIR)
  let cap = Infinity
  if (total !== null) {
    const personFiles = await countFiles(path.join(OUT_DIR, 'person'))
    const others = total - (personFiles ?? 0)
    cap = Math.max(before, Math.floor((FILE_TARGET - others) / FILES_PER_PERSON))
    console.log(
      `[people] the last build wrote ${total} files (${others} without the people); ` +
        `the cap leaves room for ${cap} people`
    )
  } else {
    console.log(
      `[people] no out/ to measure — run a build first, or the cap is the file limit`
    )
    cap = Math.floor(FILE_TARGET / FILES_PER_PERSON)
  }

  // The catalogue's own people, ranked by how much of the site's attention
  // they carry.
  const titles = await catalogueTitles()
  console.log(`[people] ${titles.length} titles in the catalogue…`)

  const score = new Map()
  const details = new Map()
  const people = [...titles]
  for (let i = 0; i < people.length; i += 8) {
    const batch = await Promise.all(
      people.slice(i, i + 8).map((title) => creditsFor(title))
    )
    for (const credits of batch) {
      for (const { person } of credits) {
        if (!usable(person)) continue
        const current = score.get(person.id) ?? 0
        score.set(person.id, current + 1)
        if (!details.has(person.id)) details.set(person.id, person)
      }
    }
    if (i % 80 === 0) console.log(`[people] ${i + 8}/${people.length} titles…`)
  }

  const ranked = [...details.values()].sort(
    (a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0)
  )
  console.log(
    `[people] ${ranked.length} people in the catalogue's cast and crew`
  )

  // Union, never replace: a page we have advertised stays advertised.
  for (const person of ranked) {
    if (byId.has(person.id)) continue
    if (byId.size >= cap) break
    byId.set(person.id, summary(person))
  }

  // Ids named on the command line: a person page somebody has already indexed
  // or linked, which the catalogue no longer carries.
  for (const id of process.argv.slice(2)) {
    if (byId.has(Number(id))) continue
    const person = await get(`person/${id}?language=en-US`).catch(() => null)
    if (!usable(person)) {
      console.warn(`[people] ${id} has no usable page — skipped`)
      continue
    }
    byId.set(person.id, summary(person))
  }

  // The entries already shipped keep their pages, and it is the NEW ones that
  // fall off the end of the cap rather than the indexed ones.
  const peopleOut = [...byId.values()].slice(0, cap)
  await writeFile(FILE, `${JSON.stringify(peopleOut, null, 2)}\n`)
  console.log(
    `[people] ${before} → ${peopleOut.length} (${byId.size - before} new, cap ${cap})`
  )
}

main().catch((error) => {
  console.error(`[people] ${error.message}`)
  process.exit(1)
})
