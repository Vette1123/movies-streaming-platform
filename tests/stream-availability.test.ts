import { describe, expect, it } from 'vitest'

import { providerHasNoStream } from '@/lib/pro/stream-availability'

// Decides whether a free visitor gets their daily trial back. Only the player
// worker's definite `stream: false` may say yes.
describe('providerHasNoStream', () => {
  const answering = (status: number, body: unknown) => {
    const asked: string[] = []
    const fetcher = (async (input: RequestInfo | URL) => {
      asked.push(String(input))
      return new Response(JSON.stringify(body), { status })
    }) as typeof fetch
    return { asked, fetcher }
  }
  const movie = { type: 'movie' as const, id: 1411621 }
  // The shared ticket secret is base64, like PLAYBACK_TICKET_SECRET.
  const SECRET = 'c2VjcmV0LXNlY3JldC1zZWNyZXQ'

  it('says yes only on a definite stream: false', async () => {
    const { fetcher } = answering(200, { stream: false })
    expect(
      await providerHasNoStream('https://p.dev/', SECRET, movie, fetcher)
    ).toBe(true)
  })

  it('keeps the trial on a stream, an unknown, or a failed call', async () => {
    for (const [status, body] of [
      [200, { stream: true }],
      [200, { stream: null }],
      [200, {}],
      [403, { error: 'unauthorized' }],
      [500, { stream: false }],
    ] as const) {
      const { fetcher } = answering(status, body)
      expect(
        await providerHasNoStream('https://p.dev', SECRET, movie, fetcher),
        `${status} ${JSON.stringify(body)}`
      ).toBe(false)
    }
    const throwing = (async () => {
      throw new TypeError('network')
    }) as typeof fetch
    expect(
      await providerHasNoStream('https://p.dev', SECRET, movie, throwing)
    ).toBe(false)
  })

  it('asks nothing when the player or the secret is not configured', async () => {
    const { asked, fetcher } = answering(200, { stream: false })
    expect(await providerHasNoStream(undefined, SECRET, movie, fetcher)).toBe(
      false
    )
    expect(
      await providerHasNoStream('https://p.dev', undefined, movie, fetcher)
    ).toBe(false)
    expect(asked).toEqual([])
  })

  it('keeps the trial when the secret is malformed, instead of throwing', async () => {
    const { fetcher } = answering(200, { stream: false })
    expect(
      await providerHasNoStream('https://p.dev', 'not base64!', movie, fetcher)
    ).toBe(false)
  })

  it('asks about the exact episode, with a ticket for it', async () => {
    const { asked, fetcher } = answering(200, { stream: false })
    await providerHasNoStream(
      'https://p.dev',
      SECRET,
      { type: 'tv', id: 67175, season: 2, episode: 5 },
      fetcher
    )
    const url = new URL(asked[0])
    expect(url.pathname).toBe('/api/stream/availability')
    expect(url.searchParams.get('type')).toBe('tv')
    expect(url.searchParams.get('id')).toBe('67175')
    expect(url.searchParams.get('season')).toBe('2')
    expect(url.searchParams.get('episode')).toBe('5')
    expect(url.searchParams.get('t')).toMatch(/^[\w-]+\.[\w-]+$/)
  })
})
