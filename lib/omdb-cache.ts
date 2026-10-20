// A build-time cache for the OMDb answers, with a daily budget.
//
// OMDb's free tier allows 1,000 requests a DAY, and the details build renders
// about a thousand pages four times a day. So three things have to be true at
// once:
//
//   1. Every answer is cached on disk, keyed by the IMDb id, and the cache
//      travels between deploys (the CI cache carries .cache/media-ratings).
//      A title is fetched ONCE and then never again — a rating is static
//      data, and re-fetching it is a request spent for nothing.
//   2. A title OMDb does not know is cached too, with a shorter life. Not
//      caching it would spend a request on every build, forever, on a title
//      that may not exist at all.
//   3. The day's spend is BOUNDED, and the bound is a file rather than a
//      counter in memory: a build must never march past the cap, because the
//      titles it skipped would then have to wait a whole day for the quota to
//      reset — and a build that asks for 1,000 things at once can be refused
//      mid-way, which is how a catalogue ends up permanently half-filled.
//
// The counter is read and written under a lock file, so two render processes
// cannot both decide there is budget left.
//
// The cache lives in `.cache/`, NOT in `public/`: it is a build input, not
// something the site serves. The ratings themselves end up in the prerendered
// HTML, which is where a reader (and a crawler) sees them.
//
// Nothing here runs in the Worker: there is no filesystem there, and the
// Worker never asks for these ratings (the details pages that show them are
// prerendered).

import path from 'node:path'

/**
 * Where the cache lives. Overridable so the budget and the cache can be pointed
 * at a scratch directory by the tests.
 */
const cacheDir = () =>
  process.env.OMDB_CACHE_DIR ??
  path.join(process.cwd(), '.cache', 'media-ratings')
const budgetFile = () => path.join(cacheDir(), 'budget.json')
const lockFile = () => path.join(cacheDir(), '.budget.lock')

/**
 * How many requests one day may spend, against OMDb's 1,000.
 *
 * Below the cap on purpose: a request that is refused still costs the day,
 * and the cap is a calendar day on OMDb's side, not ours. 800 leaves room
 * for a build that runs twice in a day and for the last few titles to land
 * on the next day's first build rather than never.
 */
export const DAILY_BUDGET = 800

/** A rating that has been seen. Refreshed after this long. */
export const FRESH_MS = 30 * 24 * 60 * 60 * 1000
/** A title OMDb does not have. Re-checked after this long. */
export const MISSING_MS = 7 * 24 * 60 * 60 * 1000

/**
 * True where there is a filesystem to cache into: the build, `next dev` and the
 * tests.
 *
 * `NEXT_PHASE` alone is not the test: it is set during a build and NOT in
 * `next dev` (measured, not assumed), so dev would have had no cache and no
 * budget — and the budget is what decides whether a request happens at all.
 * The Worker bundle inlines NODE_ENV as "production" and has no NEXT_PHASE,
 * so it is false there: the Worker never asks for these ratings.
 */
export const canCacheOmdb = (): boolean =>
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NODE_ENV !== 'production'

const fileFor = (imdbId: string) => path.join(cacheDir(), `${imdbId}.json`)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface CachedOmdb<T> {
  /** When the answer was written. */
  at: number
  /** The answer, or null for a title OMDb does not know. */
  value: T | null
}

/**
 * The cached answer for an IMDb id, or null when there is none.
 *
 * Fails soft in every direction: no cache directory, an unreadable file, a
 * file that is not the shape we wrote. A missing rating is not a broken build.
 */
export const readCachedOmdb = async <T>(
  imdbId: string
): Promise<CachedOmdb<T> | null> => {
  if (!canCacheOmdb()) return null
  try {
    const [{ readFile }, { existsSync }] = await Promise.all([
      import('node:fs/promises'),
      import('node:fs'),
    ])
    const file = fileFor(imdbId)
    if (!existsSync(file)) return null
    const parsed = JSON.parse(await readFile(file, 'utf8')) as CachedOmdb<T>
    if (typeof parsed?.at !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

/** Write the answer for an IMDb id. Fails soft — see above. */
export const writeCachedOmdb = async (
  imdbId: string,
  value: unknown
): Promise<void> => {
  if (!canCacheOmdb()) return
  try {
    const { mkdir, writeFile } = await import('node:fs/promises')
    await mkdir(cacheDir(), { recursive: true })
    const payload: CachedOmdb<unknown> = { at: Date.now(), value }
    await writeFile(fileFor(imdbId), JSON.stringify(payload), 'utf8')
  } catch {
    // A cache that cannot be written is a slower build, not a failed one.
  }
}

/** Today, in UTC — the same clock OMDb's daily quota resets on. */
const utcDay = (): string => new Date().toISOString().slice(0, 10)

/**
 * Run a function while holding the budget lock.
 *
 * The lock is an exclusively-created file: whoever creates it owns the
 * counter until it is removed. Waiting for it is a short sleep, and the
 * holder is a few milliseconds, so the queue is short. If the lock cannot be
 * taken (a stale lock left by a killed build, say), the work runs anyway:
 * over-counting a little is better than failing a build.
 */
const withBudgetLock = async <T>(fn: () => Promise<T>): Promise<T> => {
  const { open, unlink, mkdir } = await import('node:fs/promises')
  try {
    await mkdir(cacheDir(), { recursive: true })
    for (let attempt = 0; attempt < 40; attempt++) {
      let handle: { close: () => Promise<void> } | null = null
      try {
        handle = await open(lockFile(), 'wx')
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== 'EEXIST') throw error
        await sleep(40 + Math.random() * 60)
        continue
      }
      try {
        return await fn()
      } finally {
        await handle.close().catch(() => undefined)
        await unlink(lockFile()).catch(() => undefined)
      }
    }
  } catch {
    // A lock we cannot take is not a reason to skip the work.
  }
  return fn()
}

/**
 * Take one request from today's budget.
 *
 * Returns false when the day's spend is already at the cap — the caller must
 * then answer from the cache alone, or not at all.
 *
 * The cap is a parameter so the test can fill a small budget instead of eight
 * hundred requests; the production path uses the constant.
 */
export const takeOmdbBudget = async (
  budget: number = DAILY_BUDGET
): Promise<boolean> => {
  if (!canCacheOmdb()) return false
  return withBudgetLock(async () => {
    const { readFile, writeFile } = await import('node:fs/promises')
    let used = 0
    let day = utcDay()
    try {
      const parsed = JSON.parse(await readFile(budgetFile(), 'utf8')) as {
        day?: string
        used?: number
      }
      // A new calendar day starts with the whole budget again.
      if (parsed.day === day && typeof parsed.used === 'number') {
        used = parsed.used
      }
    } catch {
      // No budget file yet: the first request of the day.
    }
    if (used >= budget) return false
    await writeFile(
      budgetFile(),
      JSON.stringify({ day, used: used + 1 }),
      'utf8'
    ).catch(() => undefined)
    return true
  })
}

/** How much of today's budget is left. For the build log. */
export const omdbBudgetLeft = async (): Promise<number> => {
  if (!canCacheOmdb()) return 0
  try {
    const { readFile } = await import('node:fs/promises')
    const parsed = JSON.parse(await readFile(budgetFile(), 'utf8')) as {
      day?: string
      used?: number
    }
    if (parsed.day !== utcDay()) return DAILY_BUDGET
    return Math.max(0, DAILY_BUDGET - (parsed.used ?? 0))
  } catch {
    return DAILY_BUDGET
  }
}
