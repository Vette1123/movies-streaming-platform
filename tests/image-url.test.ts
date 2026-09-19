import { describe, expect, it } from 'vitest'

import {
  getImageURL,
  getLogoImageSrcSet,
  getLogoImageURL,
  getPosterImageURL,
  getThumbBackdropURL,
  getThumbPosterURL,
} from '@/lib/utils'

/**
 * TMDB returns `null` for `backdrop_path`, `poster_path` and `logo_path`
 * whenever a title has no art, and every builder here takes the path as a
 * template-literal argument. Before the guard, `null` stringified straight into
 * the URL: `/original` + `null` = `/originalnull`, which Cloudflare logged 22
 * times a day, and each one then walked BlurredImage's whole onError chain, so
 * one missing poster cost three 404s across ImageKit, wsrv and TMDB's origin.
 *
 * The builders are typed `string | null | undefined` now, so this is the test
 * that the runtime agrees with the type - a `string`-typed DTO field that is
 * null at runtime is exactly how the bug got in past the compiler.
 */
const BUILDERS = {
  getImageURL,
  getPosterImageURL,
  getLogoImageURL,
  getThumbPosterURL,
  getThumbBackdropURL,
} as const

const MISSING = [null, undefined, ''] as const

describe('image URL builders with no path', () => {
  for (const [name, build] of Object.entries(BUILDERS)) {
    for (const missing of MISSING) {
      it(`${name} emits no request for ${JSON.stringify(missing)}`, () => {
        const url = build(missing)
        // The literal failure that shipped. Worth naming, so a regression says
        // what it is rather than just failing a `startsWith`.
        expect(url).not.toContain('null')
        expect(url).not.toContain('undefined')
        // A data URI is the point: it costs no request at all, so a title with
        // no art cannot reach the network or the fallback chain.
        expect(url.startsWith('data:image/')).toBe(true)
      })
    }
  }

  it('getLogoImageSrcSet omits the attribute rather than offering a placeholder twice', () => {
    // "No image at any density" is an absent attribute. Two candidates pointing
    // at the same transparent pixel would have the browser choose between them
    // and then paint nothing.
    for (const missing of MISSING) {
      expect(getLogoImageSrcSet(missing)).toBeUndefined()
    }
  })
})

describe('image URL builders with a path', () => {
  const path = '/abc123.jpg'

  it('still build a real transform URL', () => {
    expect(getImageURL(path)).toContain('/original/abc123.jpg')
    expect(getPosterImageURL(path)).toContain('/w500/abc123.jpg')
    expect(getThumbPosterURL(path)).toContain('/w300/abc123.jpg')
  })

  it('getLogoImageSrcSet hands out a 1x/2x pair at two real widths', () => {
    const srcSet = getLogoImageSrcSet(path)
    expect(srcSet).toContain(' 1x, ')
    expect(srcSet).toContain(' 2x')
    expect(srcSet).toContain('w-500')
    expect(srcSet).toContain('w-1000')
    // Counted the way a browser counts them. srcset candidates are split on
    // commas that FOLLOW a descriptor, not on every comma - an ImageKit
    // transform URL carries three of its own (`tr:w-500,q-70,f-auto,c-at_max`)
    // and they stay part of the URL because no whitespace follows them. A
    // naive split(',') here reports eight candidates for a valid srcset, which
    // is how this assertion was wrong the first time.
    expect(srcSet?.split(/,\s/)).toHaveLength(2)
  })
})
