#!/usr/bin/env node
/**
 * Refresh data/media-ratings.json — the committed ratings snapshot.
 *
 * The details page shows IMDb, Rotten Tomatoes, Metacritic and TMDB. IMDb and
 * TMDB are free and keyless. Rotten Tomatoes and Metacritic are not: there is
 * no free official RT API, and OMDb's free tier allows 1,000 requests a DAY.
 *
 * So the answers live in the repository, and this script is the only thing
 * that asks OMDb for them. It runs once a day in CI (workflows/ratings.yml)
 * and commits what it learns, which means:
 *
 *   - the BUILD never calls OMDb at all. It reads the file. A deploy is
 *     quota-free, and a deploy cannot be slowed by a third party's cap.
 *   - the daily quota is only ever spent on titles nobody has looked up yet.
 *     After the first two days the catalogue is covered and the quota is
 *     untouched; from then on the script spends a handful of requests a day
 *     on whatever is new.
 *   - the file is the floor. If OMDb is down, over its limit, or gone, every
 *     title keeps the scores it already had, and the build does not notice.
 *
 *   pnpm ratings:refresh                # fill in what is missing
 *   pnpm ratings:refresh --limit 900    # ...and never spend more than this
 *
 * Its limits, stated so nobody is surprised:
 *   - it spends the DAILY quota, once a day, on purpose.
 *   - it merges; it never removes. A rating that stops being published stays.
 *   - it needs TMDB (free, no quota) to find which titles the site carries,
 *     and OMDb (free, 1,000/day) for the scores.
 */
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadLocalEnv } from './load-env.mjs'

loadLocalEnv()

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const FILE = path.join(root, 'data', 'media-ratings.json')
const CONFIG = path.join(root, 'config', 'catalogue.json')

const BASE = process.env.NEXT_PUBLIC_TMDB_BASEURL
const TOKEN = process.env.TMDB_HEADER_KEY
const KEY = process.env.OMDB_API_KEY

/**
 * How many requests one run may spend.
 *
 * The free tier allows 1,000 a day and the workflow runs once a day, so this
 * leaves the day's cap for a second run (a manual one, or a re-run of a failed
 * job) instead of walking into it.
 */
const limitIndex = process.argv.indexOf('--limit')
const LIMIT =
  limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) || 900 : 900

const get = async (endpoint) => {
  const res = await fetch(`${BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`${endpoint} -> ${res.status}`)
  return res.json()
}

/**
 * The titles the site carries — the same lists, the same depths, from the same
 * config the build reads (config/catalogue.json). A rating for a title the site
 * does not have is a rating nobody will ever see.
 */
const catalogueIds = async () => {
  const { listDepth } = JSON.parse(await readFile(CONFIG, 'utf8'))
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
        if (item?.id) ids.set(`${type}-${item.id}`, { type, id: item.id })
      }
    }
  }
  return [...ids.values()]
}

/** The IMDb id of a title — the key the whole file hangs on. */
const imdbIdFor = async ({ type, id }) => {
  const data = await get(`${type}/${id}/external_ids?language=en-US`).catch(
    () => null
  )
  return data?.imdb_id ?? null
}

const percent = (value) => {
  const number = Number.parseFloat(String(value ?? '').replace('%', ''))
  return Number.isFinite(number) ? number : undefined
}

async function main() {
  if (!BASE || !TOKEN) throw new Error('TMDB_HEADER_KEY / base URL missing')
  if (!KEY) {
    console.error(
      'OMDB_API_KEY is not set. The free key is at https://www.omdbapi.com/apikey.aspx'
    )
    process.exit(1)
  }

  const known = JSON.parse(await readFile(FILE, 'utf8').catch(() => '{}'))
  const titles = await catalogueIds()
  console.log(
    `[ratings] ${Object.keys(known).length} known, ${titles.length} titles in the catalogue`
  )

  let fetched = 0
  let spent = 0
  for (const title of titles) {
    if (spent >= LIMIT) {
      console.log(`[ratings] stopping at the ${LIMIT}-request limit`)
      break
    }
    const imdbId = await imdbIdFor(title)
    if (!imdbId || known[imdbId]) continue

    spent++
    const res = await fetch(
      `https://www.omdbapi.com/?apikey=${KEY}&i=${imdbId}`
    ).catch(() => null)
    if (!res) continue
    if (res.status === 401) {
      console.warn(
        '[ratings] OMDb refused the request — the daily cap is spent'
      )
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
    if (rotten) entry.rt = percent(rotten.Value)
    if (meta) entry.mc = percent(meta.Value)
    if (body.imdbRating && body.imdbRating !== 'N/A') {
      entry.imdb = Number.parseFloat(body.imdbRating)
    }
    if (body.imdbVotes && body.imdbVotes !== 'N/A') {
      entry.votes = body.imdbVotes
    }
    if (!Object.keys(entry).length) continue
    known[imdbId] = entry
    fetched++
  }

  await writeFile(FILE, `${JSON.stringify(known, null, 2)}\n`)
  console.log(
    `[ratings] fetched ${fetched} (${spent} requests spent), ${Object.keys(known).length} known`
  )
}

main().catch((error) => {
  console.error(`[ratings] ${error.message}`)
  process.exit(1)
})
