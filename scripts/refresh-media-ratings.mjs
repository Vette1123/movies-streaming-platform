#!/usr/bin/env node
/**
 * Refresh data/media-ratings.json — the committed ratings snapshot.
 *
 * The details page shows IMDb, Rotten Tomatoes, Metacritic and TMDB. IMDb and
 * TMDB are free and always there; Rotten Tomatoes and Metacritic come from
 * OMDb's free tier, which allows 1,000 requests a DAY. That is a budget, not
 * a source: the build must never depend on it, or a title without a cached
 * answer is a title without a score.
 *
 * So the answers live in the repository. This command is the only thing that
 * asks OMDb for them, it merges what it gets into the file, and the build
 * reads the file — no key, no quota, no network, no failure mode.
 *
 *   pnpm ratings:refresh          # fill in what is missing
 *   pnpm ratings:refresh --limit 50
 *
 * The titles it asks about are the ones the build wanted: the build leaves a
 * list of the ids it rendered (next to its answers, in the same directory the
 * CI cache carries), and this reads it. Run a build first, or the list is
 * empty and the command has nothing to do.
 *
 * Its limits, stated so nobody is surprised:
 *   - it spends the DAILY quota. A day's quota is a day's quota: if this
 *     runs at 23:50 it may be refused for the rest of the day, and the
 *     missing titles wait for tomorrow.
 *   - it merges; it never removes. A rating that stops being published stays.
 *   - it does not read the web, only OMDb.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(root, 'data', 'media-ratings.json')
const CACHE_DIR = path.join(root, '.cache', 'media-ratings')

const KEY = process.env.OMDB_API_KEY
const BASE = 'https://www.omdbapi.com/'

/** How many to ask for in one run. The daily cap is 1,000; stay well under. */
const limitIndex = process.argv.indexOf('--limit')
const LIMIT = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) || 50 : 200

const readJson = async (file, fallback) =>
  JSON.parse(await readFile(file, 'utf8').catch(() => fallback))

async function main() {
  if (!KEY) {
    console.error(
      'OMDB_API_KEY is not set. The free key is at https://www.omdbapi.com/apikey.aspx'
    )
    process.exit(1)
  }

  const committed = await readJson(FILE, '{}')

  // First, fold in what the last build learned: its answers are in the cache
  // directory, one file per title, and they are fresher than the file.
  const { readdir } = await import('node:fs/promises')
  const files = await readdir(CACHE_DIR).catch(() => [])
  let folded = 0
  for (const file of files) {
    if (!file.endsWith('.json') || file === 'budget.json') continue
    const raw = await readJson(path.join(CACHE_DIR, file), 'null')
    if (!raw?.value) continue
    const id = file.replace('.json', '')
    const entry = {}
    if (raw.value.rottenTomatoes !== undefined)
      entry.rt = raw.value.rottenTomatoes
    if (raw.value.metacritic !== undefined) entry.mc = raw.value.metacritic
    if (raw.value.imdbRating !== undefined) entry.imdb = raw.value.imdbRating
    if (raw.value.imdbVotes !== undefined)
      entry.votes = String(raw.value.imdbVotes)
    if (!Object.keys(entry).length) continue
    const known = committed[id]
    if (
      known &&
      known.rt === entry.rt &&
      known.mc === entry.mc &&
      known.imdb === entry.imdb
    ) {
      continue
    }
    committed[id] = entry
    folded++
  }
  if (folded) console.log(`[ratings] folded ${folded} answer(s) from the cache`)

  const wanted = await readJson(path.join(CACHE_DIR, 'wanted.json'), '[]')

  // Everything the build asked about, minus what we already know.
  const ids = [...new Set([...wanted])].filter(
    (id) => typeof id === 'string' && !committed[id]
  )
  console.log(
    `[ratings] ${Object.keys(committed).length} known, ${ids.length} missing`
  )
  if (!ids.length) {
    await writeFile(FILE, `${JSON.stringify(committed, null, 2)}\n`)
    console.log('[ratings] nothing to fetch')
    return
  }

  const batch = ids.slice(0, LIMIT)
  let fetched = 0
  let refused = 0
  for (const id of batch) {
    const res = await fetch(`${BASE}?apikey=${KEY}&i=${id}`).catch(() => null)
    if (!res) continue
    if (res.status === 401) {
      refused++
      break
    }
    const body = await res.json().catch(() => null)
    if (!body || body.Response !== 'True') continue
    const entry = {}
    const rotten = (body.Ratings ?? []).find(
      (row) => row.Source?.toLowerCase() === 'rotten tomatoes'
    )
    const meta = (body.Ratings ?? []).find(
      (row) => row.Source?.toLowerCase() === 'metacritic'
    )
    const percent = (value) => {
      const number = Number.parseFloat(String(value ?? '').replace('%', ''))
      return Number.isFinite(number) ? number : undefined
    }
    if (rotten) entry.rt = percent(rotten.Value)
    if (meta) entry.mc = percent(meta.Value)
    if (body.imdbRating && body.imdbRating !== 'N/A') {
      entry.imdb = Number.parseFloat(body.imdbRating)
    }
    if (body.imdbVotes && body.imdbVotes !== 'N/A') entry.votes = body.imdbVotes
    if (Object.keys(entry).length) {
      committed[id] = entry
      fetched++
    }
  }

  await writeFile(FILE, `${JSON.stringify(committed, null, 2)}\n`)
  console.log(
    `[ratings] fetched ${fetched}, now ${Object.keys(committed).length} known` +
      (refused ? ' (OMDb refused — the daily cap is spent; try tomorrow)' : '')
  )
}

main().catch((error) => {
  console.error(`[ratings] ${error.message}`)
  process.exit(1)
})
