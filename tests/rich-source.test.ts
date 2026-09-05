import { afterEach, describe, expect, it, vi } from 'vitest'

// config/sources.ts reads its env at module init, so each scenario re-imports
// it under a fresh process.env. Next inlines these textually for the app build
// — what is under test here is the PARSING and the tier/list contract.
async function importWithEnv(env: Record<string, string | undefined>) {
  vi.resetModules()
  const saved: Record<string, string | undefined> = {}
  for (const key of Object.keys(env)) {
    saved[key] = process.env[key]
    if (env[key] === undefined) delete process.env[key]
    else process.env[key] = env[key]
  }
  try {
    return await import('@/config/sources')
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

const BASE_ENV = {
  NEXT_PUBLIC_STREAMING_MOVIES_API_URL: 'https://a.example/embed',
  NEXT_PUBLIC_STREAM_SOURCE_2: 'https://b.example/embed',
}

describe('slot defaults and labels', () => {
  afterEach(() => vi.resetModules())

  it('defaults to slot 2 (the more resilient embed)', async () => {
    const mod = await importWithEnv(BASE_ENV)
    expect(mod.DEFAULT_SOURCE_ID).toBe('b.example')
    expect(mod.STREAM_SOURCES[0].id).toBe('b.example')
  })

  it('honours NEXT_PUBLIC_STREAM_DEFAULT_SLOT', async () => {
    const mod = await importWithEnv({
      ...BASE_ENV,
      NEXT_PUBLIC_STREAM_DEFAULT_SLOT: '1',
    })
    expect(mod.DEFAULT_SOURCE_ID).toBe('a.example')
  })

  it('falls back to the first configured slot when the default is absent', async () => {
    const mod = await importWithEnv({
      NEXT_PUBLIC_STREAM_SOURCE_2: 'https://b.example/embed',
    })
    expect(mod.DEFAULT_SOURCE_ID).toBe('b.example')
  })

  // CI resolves an absent GitHub secret to '' — and Number('') is 0, which
  // would silently move the public default off Server 2.
  it('treats an empty NEXT_PUBLIC_STREAM_DEFAULT_SLOT as unset', async () => {
    const mod = await importWithEnv({
      ...BASE_ENV,
      NEXT_PUBLIC_STREAM_DEFAULT_SLOT: '',
    })
    expect(mod.DEFAULT_SOURCE_ID).toBe('b.example')
  })

  it('labels come from env overrides', async () => {
    const mod = await importWithEnv({
      ...BASE_ENV,
      NEXT_PUBLIC_STREAM_SOURCE_2_LABEL: 'Turbo',
    })
    expect(mod.STREAM_SOURCES.find((s) => s.id === 'b.example')?.label).toBe(
      'Turbo'
    )
  })
})

describe('path templates (non-vidsrc-shaped providers)', () => {
  afterEach(() => vi.resetModules())

  it('fills {id}/{s}/{e} in custom movie and tv paths', async () => {
    const mod = await importWithEnv({
      ...BASE_ENV,
      NEXT_PUBLIC_STREAM_SOURCE_4: 'https://c.example',
      NEXT_PUBLIC_STREAM_SOURCE_4_MOVIE_PATH: '/embed/{id}',
      NEXT_PUBLIC_STREAM_SOURCE_4_TV_PATH: '/embedtv/{id}?s={s}&e={e}',
    })
    const src = mod.STREAM_SOURCES.find((s) => s.id === 'c.example')!
    expect(mod.movieStreamUrl(src, 550)).toBe('https://c.example/embed/550')
    expect(mod.seriesStreamUrl(src, 1396, { season: 2, episode: 7 })).toBe(
      'https://c.example/embedtv/1396?s=2&e=7'
    )
  })

  it('keeps the vidsrc shape as the default path', async () => {
    const mod = await importWithEnv(BASE_ENV)
    const src = mod.STREAM_SOURCES.find((s) => s.id === 'a.example')!
    expect(mod.movieStreamUrl(src, 550)).toBe(
      'https://a.example/embed/movie/550'
    )
    expect(mod.seriesStreamUrl(src, 1396, { season: 1, episode: 7 })).toBe(
      'https://a.example/embed/tv/1396/1/7'
    )
  })
})

describe('visibleSourcesFor tiers', () => {
  afterEach(() => vi.resetModules())

  const TRIAL_ENV = { ...BASE_ENV, NEXT_PUBLIC_PRO_TRIAL_SELFHOST: 'true' }

  it('anonymous: the default server only', async () => {
    const mod = await importWithEnv(TRIAL_ENV)
    const list = mod.visibleSourcesFor(false, false)
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('b.example')
  })

  it('signed-in free: every embed, no self-host, default first', async () => {
    const mod = await importWithEnv(TRIAL_ENV)
    const list = mod.visibleSourcesFor(true, false)
    expect(list.some((s) => s.id === mod.REELY_SOURCE_ID)).toBe(false)
    expect(list.map((s) => s.id)).toEqual(['b.example', 'a.example'])
  })

  it('supporters: our player first, then every embed', async () => {
    const mod = await importWithEnv(TRIAL_ENV)
    const list = mod.visibleSourcesFor(true, true)
    expect(list[0].id).toBe(mod.REELY_SOURCE_ID)
    expect(list.slice(1)).toEqual(mod.STREAM_SOURCES)
  })

  it('lapsed supporters drop back exactly to the signed-in free list', async () => {
    const mod = await importWithEnv(TRIAL_ENV)
    expect(mod.visibleSourcesFor(true, false)).toEqual(
      mod.visibleSourcesFor(true, false)
    )
    expect(
      mod
        .visibleSourcesFor(true, false)
        .some((s) => s.id === mod.REELY_SOURCE_ID)
    ).toBe(false)
  })
})

/**
 * The precedence that decides what plays. The bug this pins: a supporter's
 * Settings choice was skipped entirely, so every title opened in the house
 * player no matter what they picked — and the switcher was hidden there, so
 * there was no way out of it from the page either.
 */
describe('resolveSourceId precedence', () => {
  afterEach(() => vi.resetModules())

  const TRIAL_ENV = { ...BASE_ENV, NEXT_PUBLIC_PRO_TRIAL_SELFHOST: 'true' }

  it('supporters default to the house player with nothing chosen', async () => {
    const mod = await importWithEnv(TRIAL_ENV)
    expect(
      mod.resolveSourceId({
        sources: mod.visibleSourcesFor(true, true),
        pro: true,
      })
    ).toBe(mod.REELY_SOURCE_ID)
  })

  it("a supporter's Settings server wins over the house player", async () => {
    const mod = await importWithEnv(TRIAL_ENV)
    expect(
      mod.resolveSourceId({
        sources: mod.visibleSourcesFor(true, true),
        accountSource: 'a.example',
        pro: true,
      })
    ).toBe('a.example')
  })

  it('the per-title memory wins over the Settings server', async () => {
    const mod = await importWithEnv(TRIAL_ENV)
    expect(
      mod.resolveSourceId({
        sources: mod.visibleSourcesFor(true, true),
        remembered: mod.REELY_SOURCE_ID,
        accountSource: 'a.example',
        pro: true,
      })
    ).toBe(mod.REELY_SOURCE_ID)
  })

  it('a device switch does not move a supporter off the house player', async () => {
    const mod = await importWithEnv(TRIAL_ENV)
    expect(
      mod.resolveSourceId({
        sources: mod.visibleSourcesFor(true, true),
        devicePreference: 'a.example',
        pro: true,
      })
    ).toBe(mod.REELY_SOURCE_ID)
  })

  it('a device switch DOES carry for a free account', async () => {
    const mod = await importWithEnv(TRIAL_ENV)
    expect(
      mod.resolveSourceId({
        sources: mod.visibleSourcesFor(true, false),
        devicePreference: 'a.example',
        pro: false,
      })
    ).toBe('a.example')
  })

  it('ignores a stored id the visitor no longer has access to', async () => {
    const mod = await importWithEnv(TRIAL_ENV)
    // A lapsed supporter, still carrying the house player in every store.
    expect(
      mod.resolveSourceId({
        sources: mod.visibleSourcesFor(true, false),
        remembered: mod.REELY_SOURCE_ID,
        accountSource: mod.REELY_SOURCE_ID,
        pro: false,
      })
    ).toBe(mod.DEFAULT_SOURCE_ID)
  })

  it('anonymous visitors resolve to the default however much is stored', async () => {
    const mod = await importWithEnv(TRIAL_ENV)
    expect(
      mod.resolveSourceId({
        sources: mod.visibleSourcesFor(false, false),
        remembered: 'a.example',
        accountSource: 'a.example',
        devicePreference: 'a.example',
        pro: false,
      })
    ).toBe(mod.DEFAULT_SOURCE_ID)
  })
})
