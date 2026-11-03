import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

const { fetchClient } = await import('@/lib/fetch-client')
const { notFoundOrThrow } = await import('@/lib/not-found')
const { nullIfNotFound, isUpstreamUnavailable } = await import('@/lib/upstream')

const respond = (status: number) =>
  new Response(status === 200 ? '{"id":1}' : '{}', { status })

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('a transient TMDB failure is never a 404', () => {
  it('retries a TMDB 5xx and returns the good answer', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(503))
      .mockResolvedValueOnce(respond(502))
      .mockResolvedValueOnce(respond(200))
    vi.stubGlobal('fetch', fetchMock)
    const pending = fetchClient.get('collection/1')
    await vi.advanceTimersByTimeAsync(5000)
    await expect(pending).resolves.toEqual({ id: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry a real 404', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(404))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchClient.get('collection/1')).rejects.toMatchObject({
      status: 404,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('page: only a TMDB 404 becomes notFound, anything else is rethrown', () => {
    expect(() =>
      notFoundOrThrow(Object.assign(new Error('x'), { status: 404 }))
    ).toThrow('NEXT_NOT_FOUND')
    const timeout = Object.assign(new Error('x'), { status: 503 })
    expect(() => notFoundOrThrow(timeout)).toThrow(timeout)
    const dropped = new TypeError('fetch failed')
    expect(() => notFoundOrThrow(dropped)).toThrow(dropped)
  })

  it('worker: only a TMDB 404 is null, anything else is upstream-unavailable', () => {
    expect(
      nullIfNotFound(Object.assign(new Error('x'), { status: 404 }))
    ).toBeNull()
    for (const status of [429, 500, 503]) {
      let thrown: unknown
      try {
        nullIfNotFound(Object.assign(new Error('x'), { status }))
      } catch (error) {
        thrown = error
      }
      expect(isUpstreamUnavailable(thrown)).toBe(true)
    }
    expect(isUpstreamUnavailable(new Error('bug'))).toBe(false)
  })

  it('worker loaders go through nullIfNotFound and the top-level catch answers 503', async () => {
    const { readFileSync } = await import('node:fs')
    const worker = readFileSync('cloudflare/worker.js', 'utf8')
    expect(worker).not.toMatch(/catch \{\s*return null\s*\}/)
    expect(worker.match(/return nullIfNotFound\(error\)/g)).toHaveLength(3)
    expect(worker).toMatch(/status: 503,\s*headers: \{[^}]*'Retry-After'/)
  })
})
