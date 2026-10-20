import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  DAILY_BUDGET,
  omdbBudgetLeft,
  readCachedOmdb,
  takeOmdbBudget,
  writeCachedOmdb,
} from '@/lib/omdb-cache'

/**
 * The OMDb free tier allows 1,000 requests a DAY. The details build renders
 * about a thousand pages, four times a day, so the budget is the difference
 * between a catalogue that fills up over two days and one that is locked out
 * forever. These are the rules that keep it inside the cap.
 */

let scratch: string

// A fresh directory per test: the budget counter is a file, so two tests
// sharing a directory would share the day's spend.
beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'omdb-cache-'))
  process.env.OMDB_CACHE_DIR = scratch
})

afterEach(() => {
  delete process.env.OMDB_CACHE_DIR
  rmSync(scratch, { recursive: true, force: true })
})

describe('the daily budget', () => {
  it('starts the day with the whole budget', async () => {
    expect(await omdbBudgetLeft()).toBe(DAILY_BUDGET)
  })

  it('gives one request at a time and counts them', async () => {
    expect(await takeOmdbBudget()).toBe(true)
    expect(await omdbBudgetLeft()).toBe(DAILY_BUDGET - 1)
    expect(await takeOmdbBudget()).toBe(true)
    expect(await omdbBudgetLeft()).toBe(DAILY_BUDGET - 2)
  })

  it('refuses once the cap is reached, and keeps refusing', async () => {
    // A small cap, so the test fills a budget instead of eight hundred
    // requests. The counter file is the same either way.
    const cap = 3
    const taken = await (async () => {
      let count = 0
      while (count < cap + 5) {
        if (!(await takeOmdbBudget(cap))) break
        count++
      }
      return count
    })()

    expect(taken, `took ${taken} of ${cap}`).toBe(cap)
    expect(await takeOmdbBudget(cap)).toBe(false)
  })
})

describe('the cache', () => {
  it('round-trips an answer with its timestamp', async () => {
    await writeCachedOmdb('tt0111161', { rottenTomatoes: 89 })
    const cached = await readCachedOmdb<{ rottenTomatoes: number }>('tt0111161')
    expect(cached?.value).toEqual({ rottenTomatoes: 89 })
    expect(typeof cached?.at).toBe('number')
  })

  it('round-trips a MISSING answer, so it does not cost a request forever', async () => {
    await writeCachedOmdb('tt0000000', null)
    const cached = await readCachedOmdb('tt0000000')
    expect(cached?.value).toBeNull()
    expect(typeof cached?.at).toBe('number')
  })

  it('has nothing for a title it has never seen', async () => {
    expect(await readCachedOmdb('tt9999999')).toBeNull()
  })
})
