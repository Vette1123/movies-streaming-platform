import { describe, expect, it } from 'vitest'

import {
  escapeXml,
  fitLine,
  mosaicSvg,
  mosaicUrl,
  parseMosaicCard,
} from '@/lib/og/mosaic'

const SITE = 'https://www.reely.space'

const build = (over: Partial<Parameters<typeof mosaicUrl>[0]> = {}) =>
  mosaicUrl(
    {
      title: 'Films I keep rewatching',
      subtitle: '12 titles, a list by Sara',
      posters: ['/a.jpg', '/b.jpg'],
      ...over,
    },
    SITE
  )

/** The card URL wsrv is told to fetch, back out of the mosaic URL. */
const cardParams = (url: string | null) => {
  const source = new URL(url ?? '').searchParams.get('url')
  return new URL(source ?? '').searchParams
}

describe('mosaicUrl', () => {
  it('asks wsrv to rasterise the Worker card at the unfurl size', () => {
    const url = build() ?? ''
    expect(url.startsWith('https://wsrv.nl/?url=')).toBe(true)
    expect(url).toContain('&w=1200&h=630')
    expect(url).toContain('output=jpg')
    expect(new URL(url).searchParams.get('url')).toContain(
      `${SITE}/api/og/card?`
    )
  })

  it('is null with nothing to draw, so the caller keeps its fallback', () => {
    expect(build({ posters: [] })).toBeNull()
    expect(build({ posters: [null, undefined, 'junk'] })).toBeNull()
  })

  it('caps the row at five posters and drops unsafe paths', () => {
    const paths = ['/a.jpg', '/b.jpg', '/c.jpg', '/d.jpg', '/e.jpg', '/f.jpg']
    expect(cardParams(build({ posters: paths })).get('p')).toBe(
      paths.slice(0, 5).join(',')
    )
    expect(
      cardParams(build({ posters: ['/a.jpg', '/x:y,z.jpg', '../e.jpg'] })).get(
        'p'
      )
    ).toBe('/a.jpg')
  })

  it('changes when the list is renamed, so wsrv cannot serve the old card', () => {
    expect(build({ title: 'New name' })).not.toEqual(build())
  })
})

describe('parseMosaicCard', () => {
  it('round-trips what mosaicUrl sent, Arabic included', () => {
    const url = build({ title: 'قائمة أفلام' })
    expect(parseMosaicCard(cardParams(url))).toEqual({
      title: 'قائمة أفلام',
      subtitle: '12 titles, a list by Sara',
      posters: ['/a.jpg', '/b.jpg'],
    })
  })

  it('refuses a request naming no real poster', () => {
    expect(parseMosaicCard(new URLSearchParams('t=hi'))).toBeNull()
    expect(
      parseMosaicCard(new URLSearchParams('t=hi&p=/etc/passwd'))
    ).toBeNull()
  })

  it('cuts text a direct caller made too long', () => {
    const card = parseMosaicCard(
      new URLSearchParams({ t: 'x'.repeat(500), p: '/a.jpg' })
    )
    expect(card?.title.length).toBeLessThanOrEqual(32)
  })
})

describe('mosaicSvg', () => {
  const card = { title: 'T', subtitle: 'S', posters: ['/a.jpg', '/b.jpg'] }

  it('cannot be broken out of by a list name', () => {
    const svg = mosaicSvg(
      { ...card, title: '</text><script>alert(1)</script>' },
      null,
      []
    )
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
  })

  it('leaves out a poster that failed and recentres the row', () => {
    const svg = mosaicSvg(card, 'data:wall', ['data:one', null])
    expect(svg).toContain('data:one')
    expect(svg).toContain('x="505"')
  })
})

describe('fitLine', () => {
  it('collapses whitespace', () => {
    expect(fitLine('  Films   I keep\nrewatching ', 40)).toBe(
      'Films I keep rewatching'
    )
  })

  it('cuts with an ellipsis inside the limit', () => {
    const cut = fitLine('x'.repeat(80), 32)
    expect(cut).toHaveLength(32)
    expect(cut.endsWith('…')).toBe(true)
  })
})

describe('escapeXml', () => {
  it('escapes markup and strips control characters', () => {
    expect(escapeXml(`a&b"c\u0007`)).toBe('a&amp;b&quot;c')
  })
})
