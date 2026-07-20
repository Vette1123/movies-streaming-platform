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

// MANDATORY per-request timeout. Without it a single stalled TMDB connection
// never settles, so the `finally { release() }` below never runs and its
// semaphore slot leaks forever. Leak MAX_CONCURRENT slots and every later
// request blocks in `acquire()` for good — the Workers runtime then kills the
// isolate with "your Worker's code had hung and would never generate a
// response". A bounded fetch turns that hang into a normal rejection that
// callers already handle (fail-soft to empty/null). Do NOT remove.
const FETCH_TIMEOUT_MS = 8000

let active = 0
const waiters: Array<() => void> = []

// `active` is the SINGLE source of truth for in-flight GETs. release() always
// decrements it and then wakes waiters to re-check.
//
// The old design instead "handed" a freed slot to one waiter without
// decrementing. That strands slots: an RSC prefetch (the `_rsc` requests) is
// routinely aborted mid-wait when the user navigates away, and a slot handed to
// such a dead waiter's continuation — which never reaches its `finally {
// release() }` — is never returned. Enough of those and every later request
// blocks in acquire() forever and the isolate is killed. Waking-and-rechecking
// can't strand a slot: a wake delivered to a dead waiter is simply lost, and the
// decrement already reflects the free slot for the next live caller. We wake
// ALL waiters (not just one) so a lost wake can never leave a live waiter
// stranded behind an aborted one; only as many as have capacity proceed, the
// rest re-queue on the next loop iteration.
const acquire = async (): Promise<void> => {
  while (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiters.push(resolve))
  }
  active++
}

const release = (): void => {
  active--
  const woken = waiters.splice(0)
  woken.forEach((wake) => wake())
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
          // A fresh timeout per attempt so a stalled connection aborts instead
          // of hanging (and leaking its semaphore slot). See FETCH_TIMEOUT_MS.
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
