import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { siteConfig } from '@/config/site'
import { hubPortraitSrc } from '@/lib/image-loader'
import {
  BRAND_PROFILES,
  movieJsonLd,
  organizationJsonLd,
  titleSameAs,
  tvSeriesJsonLd,
  websiteJsonLd,
} from '@/lib/structured-data'
import { getPosterImageURL } from '@/lib/utils'

describe('title sameAs', () => {
  it('names TMDB always and IMDb only for a real tt id', () => {
    expect(titleSameAs('movie', 550, 'tt0137523')).toEqual([
      'https://www.themoviedb.org/movie/550',
      'https://www.imdb.com/title/tt0137523/',
    ])
    expect(titleSameAs('tv', 1399, null)).toEqual([
      'https://www.themoviedb.org/tv/1399',
    ])
    // An empty string or junk must not become an IMDb link.
    expect(titleSameAs('tv', 1399, '')).toHaveLength(1)
    expect(titleSameAs('movie', 1, 'nm0000093')).toHaveLength(1)
  })

  it('rides on the Movie and TVSeries schema', () => {
    const movie = movieJsonLd({
      id: 550,
      title: 'Fight Club',
      imdbId: 'tt0137523',
    })
    expect(movie.sameAs).toContain('https://www.imdb.com/title/tt0137523/')
    const series = tvSeriesJsonLd({ id: 1399, name: 'Game of Thrones' })
    expect(series.sameAs).toEqual(['https://www.themoviedb.org/tv/1399'])
  })
})

describe('organization schema', () => {
  it('names a real support contact', () => {
    expect(organizationJsonLd.contactPoint).toMatchObject({
      '@type': 'ContactPoint',
      email: expect.stringContaining('@'),
    })
  })

  // Search Console: "reely space" ranks 1, bare "reely" ranks 43. The entity has
  // to name the spellings people type and the brand's own profiles.
  it('names the brand spellings and its own profiles', () => {
    expect(websiteJsonLd.alternateName).toEqual(['Reely Space', 'reely.space'])
    expect(organizationJsonLd.sameAs).toEqual(BRAND_PROFILES)
    expect(BRAND_PROFILES).not.toContain(siteConfig.links.twitter)
  })
})

describe('hub portrait', () => {
  // /people renders ~800 tiles; a srcset per tile was 1.5 MB of the page.
  it('is one fixed-width URL, not a srcset', () => {
    const src = hubPortraitSrc(getPosterImageURL('/abc.jpg'), 75)
    expect(src).toContain('w=320')
    expect(src).not.toMatch(/\s\d+w/)
  })
})

describe('manifest aliases', () => {
  const redirects = readFileSync('public/_redirects', 'utf8')
  const config = readFileSync('next.config.mjs', 'utf8')
  it.each(['/manifest.webmanifest', '/manifest.json'])(
    '%s 301s to the real manifest, in prod and dev alike',
    (alias) => {
      expect(redirects).toMatch(
        new RegExp(
          `^${alias.replace('.', '\\.')}\\s+/site\\.webmanifest\\s+301$`,
          'm'
        )
      )
      expect(config).toContain(`source: '${alias}'`)
    }
  )
})

// cf:health listed these as 404s on 2026-11-12: crawlers and link previewers
// guess the conventional favicon paths before reading the page's <link>.
describe('favicon aliases', () => {
  const redirects = readFileSync('public/_redirects', 'utf8')
  const config = readFileSync('next.config.mjs', 'utf8')
  it.each(['/favicon.png', '/icon/favicon.ico', '/img/favicon.ico'])(
    '%s 301s to /favicon.ico, in prod and dev alike',
    (alias) => {
      const escaped = alias.replace(/[./]/g, '\\$&')
      expect(redirects).toMatch(
        new RegExp(`^${escaped}\\s+/favicon\\.ico\\s+301$`, 'm')
      )
      expect(config).toContain(`source: '${alias}'`)
    }
  )
})

describe('tail-id fallback schema', () => {
  // ~13,900 detail URLs are served by the Worker, not prerendered; a sameAs
  // only on the baked ~1,000 left most of the catalogue without it.
  const worker = readFileSync('cloudflare/worker.js', 'utf8')
  it('names the same sameAs as the prerendered pages', () => {
    expect(worker).toContain('sameAs: titleSameAs(type, id, details.imdb_id)')
  })
})
