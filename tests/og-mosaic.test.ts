import { beforeAll, describe, expect, it } from 'vitest'

type Mosaic = typeof import('@/lib/og/mosaic')

const HOST = 'https://ik.example.test'

let mosaic: Mosaic

// The host is read at module init (lib/constants), so it has to be in the
// environment before the module is imported — hence the dynamic import.
beforeAll(async () => {
  process.env.NEXT_PUBLIC_IMAGE_CACHE_HOST_URL = HOST
  mosaic = await import('@/lib/og/mosaic')
})

const POSTERS = [
  '/aaa.jpg',
  '/bbb.jpg',
  '/ccc.jpg',
  '/ddd.jpg',
  '/eee.jpg',
  '/fff.jpg',
]

const build = (over: Partial<Parameters<Mosaic['mosaicUrl']>[0]> = {}) =>
  mosaic.mosaicUrl({
    title: 'Films I keep rewatching',
    subtitle: '12 titles by Mohamed on Reely',
    posters: POSTERS,
    ...over,
  })

describe('mosaicUrl', () => {
  it('draws every poster it is given, up to the row it can fit', () => {
    const url = build() ?? ''
    expect(url.match(/l-image/g)).toHaveLength(5)
    expect(url).toContain('i-w500@@aaa.jpg')
    // The sixth would run off the card.
    expect(url).not.toContain('fff.jpg')
  })

  it('centres however many posters there are', () => {
    // Two posters have to sit in the middle, not clinging to the left edge
    // where five of them would have started.
    const two = build({ posters: ['/aaa.jpg', '/bbb.jpg'] }) ?? ''
    expect(two).toContain('lx-400')
    expect(build() ?? '').toContain('lx-85')
  })

  it('refuses a path that is not a TMDB image path', () => {
    // Poster paths come out of a synced payload — that is, out of whatever
    // somebody PUT into their own account — and land inside a URL whose commas
    // and colons are an instruction language.
    const url =
      build({
        posters: ['/aaa.jpg,l-text,ie-aGk,l-end', '/bbb.jpg'],
      }) ?? ''
    expect(url).not.toContain('l-text,ie-aGk')
    expect(url.match(/l-image/g)).toHaveLength(1)
  })

  it('has nothing to draw without a usable poster', () => {
    expect(build({ posters: [null, undefined, 'nonsense'] })).toBe(null)
    expect(build({ posters: [] })).toBe(null)
  })

  it('is one chained transformation on the image host', () => {
    const url = build() ?? ''
    expect(url.startsWith(`${HOST}/tr:w-1200,h-630`)).toBe(true)
    expect(url.endsWith('/w500/aaa.jpg')).toBe(true)
  })
})

describe('fitLine', () => {
  it('collapses whitespace and leaves a short line alone', () => {
    expect(mosaic.fitLine('  Films   I keep\nrewatching ', 40)).toBe(
      'Films I keep rewatching'
    )
  })

  it('cuts a long line rather than letting it run off the card', () => {
    // `tw-` (the layer's own wrap width) is rejected by this account, so
    // nothing else stops the text overflowing.
    const cut = mosaic.fitLine('x'.repeat(80), 32)
    expect(cut).toHaveLength(32)
    expect(cut.endsWith('…')).toBe(true)
  })
})

describe('encodeOverlayText', () => {
  it('is base64url without padding, which is what ie- accepts', () => {
    expect(mosaic.encodeOverlayText('hi')).toBe('aGk')
    expect(mosaic.encodeOverlayText('??>?')).not.toMatch(/[+/=]/)
  })

  it('survives a name that is not ASCII', () => {
    const encoded = mosaic.encodeOverlayText('Amélie — 2001')
    expect(Buffer.from(encoded, 'base64url').toString('utf8')).toBe(
      'Amélie — 2001'
    )
  })
})
