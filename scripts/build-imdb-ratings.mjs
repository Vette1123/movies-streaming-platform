// Downloads IMDb's free Non-Commercial "title.ratings" dataset and shards it
// into small static JSON files under public/imdb-ratings/ for O(1) runtime
// lookup by tconst. No API key, no rate limit. The data is licensed for
// personal/non-commercial use (https://developer.imdb.com/non-commercial-datasets).
//
// Runs before the build (see package.json). Fails SOFT: if the download or
// parse fails, it logs a warning and exits 0 so the build still succeeds — the
// app just falls back to TMDB ratings until the next successful ingest.
//
// NUM_SHARDS MUST stay in sync with services/imdb.ts.
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { createInterface } from 'node:readline'
import { createGunzip } from 'node:zlib'

const DATASET_URL = 'https://datasets.imdbws.com/title.ratings.tsv.gz'
const OUT_DIR = path.join(process.cwd(), 'public', 'imdb-ratings')
const NUM_SHARDS = 256
// Titles below this vote count are too obscure to matter and just bloat the
// shards; they transparently fall back to TMDB. Lower this to widen coverage.
const MIN_VOTES = 1000

const shardFor = (tconst) => {
  const n = parseInt(tconst.slice(2), 10)
  return Number.isFinite(n) ? n % NUM_SHARDS : 0
}

async function main() {
  console.log(`[imdb-ratings] downloading ${DATASET_URL} …`)
  const res = await fetch(DATASET_URL)
  if (!res.ok || !res.body) {
    throw new Error(`download failed: ${res.status} ${res.statusText}`)
  }

  const shards = Array.from({ length: NUM_SHARDS }, () => ({}))
  let total = 0
  let kept = 0

  const rl = createInterface({
    input: Readable.fromWeb(res.body).pipe(createGunzip()),
    crlfDelay: Infinity,
  })

  let isHeader = true
  for await (const line of rl) {
    if (isHeader) {
      isHeader = false
      continue // tconst\taverageRating\tnumVotes
    }
    const tab1 = line.indexOf('\t')
    const tab2 = line.indexOf('\t', tab1 + 1)
    if (tab1 < 0 || tab2 < 0) continue
    total++
    const votes = Number(line.slice(tab2 + 1))
    if (!(votes >= MIN_VOTES)) continue
    const tconst = line.slice(0, tab1)
    shards[shardFor(tconst)][tconst] = line.slice(tab1 + 1, tab2)
    kept++
  }

  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })
  await Promise.all(
    shards.map((s, i) =>
      writeFile(path.join(OUT_DIR, `${i}.json`), JSON.stringify(s))
    )
  )

  console.log(
    `[imdb-ratings] wrote ${kept.toLocaleString()} of ${total.toLocaleString()} titles ` +
      `(>= ${MIN_VOTES} votes) across ${NUM_SHARDS} shards → public/imdb-ratings/`
  )
}

main().catch((err) => {
  console.warn(
    `[imdb-ratings] skipped (build will use TMDB ratings): ${err?.message ?? err}`
  )
  process.exit(0)
})
