import { describe, expect, it } from 'vitest'

import {
  catalogHas,
  fetchLibraryCatalog,
  healthTargetOf,
} from '@/lib/pro/library-catalog'
import { composeReelyHealth } from '@/lib/pro/relay-health'
import { healthUrlFor, reelyUpFrom } from '@/hooks/use-reely-up'

// Tier 0 answers the question the relay never can: "does the player play THIS
// title without the relay?" While the provider outage runs, the switcher must
// still offer the player for a library title - these pin the composition, the
// membership rule and the URL the client asks with.

const CATALOG = {
  v: 1,
  titles: {
    'movie:550': {
      path: 'movie/550-3020b5/master.m3u8',
      title: 'Fight Club (test clip)',
      durationS: 30,
      files: 4,
      bytes: 993970,
    },
    'tv:1399:1:1': { path: 'tv/1399-e1/master.m3u8' },
    'tv:1399:1:2': { path: 'tv/1399-e2/master.m3u8' },
  },
}

describe('catalogHas', () => {
  it('matches a movie exactly', () => {
    expect(catalogHas(CATALOG, 'movie', 550)).toBe(true)
    expect(catalogHas(CATALOG, 'movie', 27205)).toBe(false)
  })

  it('treats a show as its episodes, like the trial budget does', () => {
    expect(catalogHas(CATALOG, 'tv', 1399)).toBe(true)
    expect(catalogHas(CATALOG, 'tv', 1668)).toBe(false)
  })

  it('reads absence, not failure, as no', () => {
    expect(catalogHas(null, 'movie', 550)).toBe(false)
    expect(catalogHas({}, 'movie', 550)).toBe(false)
    expect(catalogHas({ titles: [] }, 'movie', 550)).toBe(false)
  })
})

describe('healthTargetOf', () => {
  it('parses a per-title question', () => {
    expect(healthTargetOf('movie', '550')).toEqual({ type: 'movie', id: 550 })
    expect(healthTargetOf('tv', '1399')).toEqual({ type: 'tv', id: 1399 })
  })

  it('keeps the bare question bare', () => {
    expect(healthTargetOf(null, null)).toBeNull()
    expect(healthTargetOf('movie', null)).toBeNull()
    expect(healthTargetOf('series', '1399')).toBeNull()
    expect(healthTargetOf('movie', '0')).toBeNull()
    expect(healthTargetOf('movie', 'abc')).toBeNull()
  })
})

describe('composeReelyHealth', () => {
  const relayDown = { up: false, reason: 'player page: gated' }

  it('plays a library title with the relay down', () => {
    expect(composeReelyHealth(relayDown, true)).toEqual({
      up: true,
      library: true,
    })
  })

  it('stays down for a provider-bound title', () => {
    expect(composeReelyHealth(relayDown, false)).toEqual({
      up: false,
      reason: 'player page: gated',
      library: false,
    })
  })

  it('says nothing about the library when the relay is up', () => {
    expect(composeReelyHealth({ up: true }, false)).toEqual({
      up: true,
      library: false,
    })
  })
})

describe('healthUrlFor', () => {
  it('names the title in the site vocabulary, asked in the player vocabulary', () => {
    expect(healthUrlFor('movie:550')).toBe('/api/stream/health?ty=movie&id=550')
    expect(healthUrlFor('series:1399')).toBe('/api/stream/health?ty=tv&id=1399')
  })

  it('falls back to the bare relay question', () => {
    expect(healthUrlFor(undefined)).toBe('/api/stream/health')
    expect(healthUrlFor('')).toBe('/api/stream/health')
    expect(healthUrlFor('movie:abc')).toBe('/api/stream/health')
    expect(healthUrlFor('nonsense')).toBe('/api/stream/health')
  })
})

describe('reelyUpFrom', () => {
  it('reads the composed answer like the bare one', () => {
    expect(reelyUpFrom({ up: true, library: true })).toBe(true)
    expect(reelyUpFrom({ up: false, library: false })).toBe(false)
  })
})

describe('fetchLibraryCatalog', () => {
  it('returns the parsed catalog', async () => {
    const fetcher = (async () =>
      new Response(JSON.stringify(CATALOG), {
        status: 200,
      })) as unknown as typeof fetch
    expect(
      await fetchLibraryCatalog('https://plane.example', 'c.json', fetcher)
    ).toEqual(CATALOG)
  })

  it('reads every failure as an empty catalog', async () => {
    const notFound = (async () =>
      new Response('nope', { status: 404 })) as unknown as typeof fetch
    expect(
      await fetchLibraryCatalog('https://plane.example', 'c.json', notFound)
    ).toEqual({})
    const unreachable = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    expect(
      await fetchLibraryCatalog('https://plane.example', 'c.json', unreachable)
    ).toEqual({})
    // Unset env: tier 0 is invisible, as in the player.
    expect(await fetchLibraryCatalog(undefined, 'c.json')).toEqual({})
    expect(
      await fetchLibraryCatalog('https://plane.example', undefined)
    ).toEqual({})
  })
})
