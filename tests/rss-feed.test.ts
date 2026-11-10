import { describe, expect, it, vi } from 'vitest'

const film = {
  id: 550,
  title: 'Fight Club & Friends <uncut>',
  overview: 'Rules & more rules.',
  release_date: '1999-10-15',
  poster_path: '/p.jpg',
}

vi.mock('@/services/movies', () => ({
  getLatestTrendingMovies: async () => ({ results: [film] }),
  getPopularMovies: async () => ({ results: [] }),
}))
vi.mock('@/services/series', () => ({
  getLatestTrendingSeries: async () => ({ results: [] }),
}))

// The poster enclosure carried the wsrv URL raw, and its `&w=…&q=…` made the
// live feed invalid XML (120 bare ampersands on 2026-11-10).
describe('rss.xml', () => {
  it('is well-formed: no bare ampersand anywhere', async () => {
    const { GET } = await import('@/app/rss.xml/route')
    const xml = await (await GET()).text()
    expect(xml).toContain('<enclosure url="https://wsrv.nl/')
    expect(xml).toContain('length="0"')
    expect(xml).toContain('<lastBuildDate>')
    expect(xml.match(/&(?!amp;|lt;|gt;|quot;|apos;|#)/g)).toBeNull()
  })
})
