import queryString from 'query-string'

import { apiConfig } from '@/lib/tmdbConfig'

// TMDB returns 429 when too many requests arrive at once. During `next build`
// we prerender ~1100 detail pages across 11 workers, each firing several TMDB
// calls — hundreds of concurrent requests without a governor, which is what
// produced the build-time 429s. Two guards keep us under TMDB's limit without
// touching a single caller:
//   1. A concurrency semaphore caps how many GETs are in flight at once.
//   2. On a 429 we back off (honoring `Retry-After` when present) and retry, so
//      a throttle degrades to a slower request instead of a surfaced error.
// At runtime this is nearly free: reads are served from cache, so few TMDB
// calls are ever in flight and the retry only fires on the rare live miss.
const MAX_CONCURRENT = 10
const MAX_RETRIES = 4

let active = 0
const waiters: Array<() => void> = []

const acquire = async (): Promise<void> => {
  if (active < MAX_CONCURRENT) {
    active++
    return
  }
  // Wait for a holder to hand us its slot (see release); `active` is unchanged
  // by that handoff, so it always equals the number of live holders.
  await new Promise<void>((resolve) => waiters.push(resolve))
}

const release = (): void => {
  const next = waiters.shift()
  if (next) {
    next() // hand the slot straight to the next waiter — no decrement
  } else {
    active-- // no one waiting: free the slot
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export const fetchClient = {
  get: async <T>(
    url: string,
    params?: Record<string, string | number>,
    isHeaderAuth = false,
    revalidate = 28800
  ): Promise<T> => {
    const query = {
      ...params,
      ...(!isHeaderAuth && { api_key: apiConfig.apiKey! }),
    }

    const fullUrl = `${apiConfig.baseUrl}${queryString.stringifyUrl({ url, query })}`
    const headers = {
      'Content-Type': 'application/json',
      ...(isHeaderAuth && {
        Authorization: `Bearer ${apiConfig.headerKey}`,
      }),
    }

    await acquire()
    try {
      for (let attempt = 0; ; attempt++) {
        const res = await fetch(fullUrl, {
          method: 'GET',
          headers,
          // Default 8h ISR; callers can override (e.g. genre lists cache far
          // longer since they're canonical and rarely change).
          next: { revalidate },
        })

        // Retry a throttle rather than throwing. Keep holding the semaphore slot
        // across the backoff so we stop feeding new requests while rate-limited.
        if (res.status === 429 && attempt < MAX_RETRIES) {
          const retryAfter = Number(res.headers.get('retry-after'))
          const wait =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? retryAfter * 1000
              : Math.min(500 * 2 ** attempt, 8000)
          await sleep(wait)
          continue
        }

        if (!res.ok) {
          throw new Error(`TMDB API error: ${res.status}`)
        }
        return (await res.json()) as T
      }
    } catch (error: any) {
      console.error(error)
      throw error
    } finally {
      release()
    }
  },
  post: async <T>(url: string, body = {}): Promise<T> => {
    try {
      const res = await fetch(`${apiConfig.baseUrl}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        throw new Error(`TMDB API error: ${res.status}`)
      }
      return await res.json()
    } catch (error: any) {
      console.error(error)
      throw error
    }
  },
}
