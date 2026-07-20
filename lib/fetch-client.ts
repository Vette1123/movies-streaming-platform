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

// The concurrency governor exists ONLY for `next build`: generateStaticParams
// prerenders ~1800 detail pages, each firing several TMDB calls — hundreds of
// concurrent requests that make TMDB return 429 and break the build.
//
// In the PRODUCTION Worker runtime it is not just useless but harmful.
// `active`/`waiters` are module-global, shared across EVERY request in an
// isolate — yet at runtime there is no fan-out (reads are cache hits or a single
// call per request). One stalled request can then park every other request in
// `acquire()` until the Workers runtime kills them, which surfaces as blank
// episode lists and hydration (#418) errors.
//
// So gate the gate: govern only where a fan-out actually happens — the
// production build and the dev server (whose generateStaticParams also fans out
// on a cold request). The production server runtime flows straight through.
// Critically the DEFAULT (an unknown/undefined NEXT_PHASE) is "don't govern",
// so if the Worker ever reports an unexpected phase we fail toward the safe,
// non-blocking path rather than re-introducing the isolate hang.
const GOVERN =
  process.env.NEXT_PHASE === 'phase-production-build' ||
  process.env.NEXT_PHASE === 'phase-development-server'

// Hard ceiling on how long a caller will wait for a slot. A lost wake or a wave
// of stalled holders must NEVER block a caller forever (on Workers that becomes
// a hung request). Past this we proceed anyway — briefly overshooting
// MAX_CONCURRENT is far cheaper than a hang. Only ever reached during build.
const ACQUIRE_TIMEOUT_MS = 15000

// Per-request timeout — a LAST-RESORT net against a genuinely hung TMDB
// connection, nothing tighter. It must be generous, because the abort fires on
// WALL-CLOCK time, which includes any stretch the event loop is blocked by
// something else (Turbopack compiling in dev, a CPU-heavy render on a cold
// Worker isolate in prod). The old 8s value counted that stall time and so
// aborted perfectly healthy fetches — a single busy isolate turned every TMDB
// call into a TimeoutError, blanking episode lists and driving the #418
// hydration storm. A slow-but-fine fetch must never be killed; only a truly
// dead connection should. The semaphore that this used to protect from leaked
// slots no longer runs in the prod server runtime (see GOVERN), so there's
// nothing left for a tight timeout to guard there — err long. 60s is pure
// safety margin: a healthy TMDB call returns in well under a second, so this
// ceiling only ever trips on a genuinely dead connection, never on a
// slow-but-fine one on a cold isolate.
const FETCH_TIMEOUT_MS = 60000

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
  const deadline = Date.now() + ACQUIRE_TIMEOUT_MS
  while (active >= MAX_CONCURRENT) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) break // fail-open: never hang forever on a lost wake
    // Wake on release OR on a short self-timer, so a missed wake can only cost a
    // brief re-poll, never an unbounded stall.
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, Math.min(remaining, 500))
      waiters.push(() => {
        clearTimeout(timer)
        resolve()
      })
    })
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
    // `false` caches the fetch indefinitely (revalidate ∞) — used by the fully
    // static browse pages so their data refreshes only on the 4x/day rebuild, not
    // on an 8h ISR timer. A number sets a time-based revalidate (default 8h).
    revalidate: number | false = 28800
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

    // Only serialize behind the governor where a fan-out happens (see GOVERN).
    // In the prod server runtime this is a no-op, so no request can ever be
    // blocked by another.
    if (GOVERN) await acquire()
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
          // Drain the throttle response before looping. An unread body keeps its
          // HTTP request "in flight"; enough stranded (retries × concurrency) hit
          // the Workers in-flight cap and the runtime cancels responses to break
          // the deadlock ("a stalled HTTP response was canceled"). See docs above.
          await res.body?.cancel()
          await sleep(wait)
          continue
        }

        if (!res.ok) {
          // Same reason: release the error response's body before bailing out.
          await res.body?.cancel()
          throw new Error(`TMDB API error: ${res.status}`)
        }
        return (await res.json()) as T
      }
    } catch (error: any) {
      console.error(error)
      throw error
    } finally {
      if (GOVERN) release()
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
        // Cancel the unread body so the response can't strand an in-flight slot.
        await res.body?.cancel()
        throw new Error(`TMDB API error: ${res.status}`)
      }
      return await res.json()
    } catch (error: any) {
      console.error(error)
      throw error
    }
  },
}
