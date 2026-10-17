import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// public/sw.js caches the RSC payloads a client navigation fetches. Next's
// router hard-navigates to the RESPONSE's url whenever a payload fails its
// checks (fetch-server-response.js: not a flight response, or a build id that
// is not the page's), and a response out of the Cache API keeps the url it was
// stored from. Matched with ignoreSearch, that was another page's url: picking
// S2E5 reloaded the tab onto the ?season=2&episode=4 the payload had first been
// fetched under, every time, because that first entry was never replaced.

const SOURCE = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const ORIGIN = 'https://www.reely.space'
const payloadUrl = (query: string) => `${ORIGIN}/tv-shows/1.txt?${query}`

/** What fetch() and the Cache API hand back: a body and the url it came from. */
const served = (url: string, body: string): Response => {
  const res = new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/plain' },
  })
  Object.defineProperty(res, 'url', { value: url })
  // A browser's clone keeps the url; Node's drops a defined one.
  Object.defineProperty(res, 'clone', { value: () => served(url, body) })
  return res
}

type Listener = (event: unknown) => void

/**
 * The worker, run against a Cache API that behaves like a browser's: entries
 * in insertion order, `put` replaces an entry under the same key, and a match
 * with `ignoreSearch` returns the FIRST entry on that path.
 */
function loadWorker(network: (url: string) => string) {
  const entries: { key: string; url: string; body: string }[] = []
  const keyOf = (input: Request | string) =>
    typeof input === 'string' ? input : input.url
  const cache = {
    addAll: async () => undefined,
    put: async (input: Request | string, res: Response) => {
      const key = keyOf(input)
      const body = await res.text()
      const at = entries.findIndex((entry) => entry.key === key)
      if (at !== -1) entries.splice(at, 1)
      entries.push({ key, url: res.url, body })
    },
  }
  const caches = {
    open: async () => cache,
    keys: async () => [],
    delete: async () => true,
    match: async (
      input: Request | string,
      options?: { ignoreSearch?: boolean }
    ) => {
      const wanted = new URL(keyOf(input))
      const hit = entries.find((entry) => {
        const url = new URL(entry.key)
        return options?.ignoreSearch
          ? url.origin + url.pathname === wanted.origin + wanted.pathname
          : url.href === wanted.href
      })
      return hit ? served(hit.url, hit.body) : undefined
    },
  }
  const listeners: Record<string, Listener> = {}
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: Listener) => {
      listeners[type] = listener
    },
  }
  const fetch = async (request: Request) =>
    served(request.url, network(request.url))
  new Function('self', 'caches', 'fetch', SOURCE)(self, caches, fetch)

  const request = async (url: string) => {
    let response: Promise<Response> | undefined
    listeners.fetch({
      request: new Request(url),
      respondWith: (value: Promise<Response>) => {
        response = value
      },
    })
    const res = await response!
    // Let the background refresh land, as it would before the next click.
    await new Promise((resolve) => setTimeout(resolve, 0))
    return { url: res.url, body: await res.text() }
  }

  return { request, entries }
}

describe('sw.js RSC payload cache', () => {
  it('never answers one URL with a response that names another', async () => {
    const worker = loadWorker(() => 'payload')
    await worker.request(payloadUrl('season=2&episode=4&_rsc=a'))

    const wanted = payloadUrl('season=2&episode=5&_rsc=b')
    const res = await worker.request(wanted)

    expect(res.body).toBe('payload')
    // A synthesized response has no url of its own; the browser gives it the
    // request's. Anything else is the url Next would hard-navigate to.
    expect(['', wanted]).toContain(res.url)
  })

  it('refreshes a stale entry in place instead of serving it forever', async () => {
    let version = 0
    const worker = loadWorker(() => `build-${++version}`)
    // Stored once from an older build, under the first episode opened.
    await worker.request(payloadUrl('season=2&episode=4&_rsc=a'))
    // Served stale (the router reloads once), and refreshed behind it.
    await worker.request(payloadUrl('season=2&episode=5&_rsc=b'))

    const next = await worker.request(payloadUrl('season=2&episode=6&_rsc=c'))

    expect(next.body).toBe('build-2')
    expect(worker.entries).toHaveLength(1)
  })
})
