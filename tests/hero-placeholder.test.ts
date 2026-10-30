import { getHeroPlaceholder } from '@/services/hero-placeholder'
import { afterEach, describe, expect, it, vi } from 'vitest'

const DATA_URI = 'data:image/webp;base64,AAAA'

afterEach(() => vi.unstubAllGlobals())

describe('getHeroPlaceholder', () => {
  it('asks for nothing when the title has no backdrop', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await getHeroPlaceholder(null)).toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns the data URI wsrv answers with', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(DATA_URI))
    )
    expect(await getHeroPlaceholder('/a.jpg')).toBe(DATA_URI)
  })

  it('drops an answer that is not an image', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>busy</html>'))
    )
    expect(await getHeroPlaceholder('/b.jpg')).toBeUndefined()
  })

  it('never fails the page when the host does', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('timed out')
      })
    )
    expect(await getHeroPlaceholder('/c.jpg')).toBeUndefined()
  })

  it('holds concurrent requests to six and frees every slot', async () => {
    let running = 0
    let peak = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        running += 1
        peak = Math.max(peak, running)
        await new Promise((resolve) => setTimeout(resolve, 1))
        running -= 1
        return new Response(DATA_URI)
      })
    )
    const paths = Array.from({ length: 20 }, (_, index) => `/p${index}.jpg`)
    const results = await Promise.all(paths.map(getHeroPlaceholder))
    expect(peak).toBe(6)
    expect(results.every((result) => result === DATA_URI)).toBe(true)
  })
})
