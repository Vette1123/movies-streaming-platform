import { afterEach, describe, expect, it, vi } from 'vitest'

// config/sources.ts reads its env at module init, so each scenario re-imports
// it under a fresh process.env. Next inlines these textually for the app build
// — what is under test here is the PARSING (trim, dedupe, query attach), which
// is the part a typo would silently break.
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
    // Restore so other test files in the same worker are untouched.
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

describe('RICH_SOURCE (the supporters-only opt-in surface)', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('is null when the env var is unset', async () => {
    const mod = await importWithEnv(BASE_ENV)
    expect(mod.RICH_SOURCE).toBeNull()
  })

  it('is null when the env var is blank', async () => {
    const mod = await importWithEnv({
      ...BASE_ENV,
      NEXT_PUBLIC_STREAM_SOURCE_PRO: '   ',
    })
    expect(mod.RICH_SOURCE).toBeNull()
  })

  it('parses the host id and trims the trailing slash', async () => {
    const mod = await importWithEnv({
      ...BASE_ENV,
      NEXT_PUBLIC_STREAM_SOURCE_PRO: 'https://rich.example/',
      NEXT_PUBLIC_STREAM_SOURCE_PRO_QUERY: 'primaryColor=e11d48',
    })
    expect(mod.RICH_SOURCE).toEqual({
      id: 'rich.example',
      label: 'Reely Beta',
      base: 'https://rich.example',
      query: 'primaryColor=e11d48',
    })
  })
})

describe('visibleSourcesFor', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('offers exactly STREAM_SOURCES to anyone not opted in', async () => {
    const mod = await importWithEnv({
      ...BASE_ENV,
      NEXT_PUBLIC_STREAM_SOURCE_PRO: 'https://rich.example',
    })
    expect(mod.visibleSourcesFor(false)).toEqual(mod.STREAM_SOURCES)
    expect(
      mod
        .visibleSourcesFor(false)
        .some((s: { id: string }) => s.id === 'rich.example')
    ).toBe(false)
  })

  it('leads with the rich surface first for opted-in supporters', async () => {
    const mod = await importWithEnv({
      ...BASE_ENV,
      NEXT_PUBLIC_STREAM_SOURCE_PRO: 'https://rich.example',
    })
    const list = mod.visibleSourcesFor(true)
    expect(list[0].id).toBe('rich.example')
    expect(list.slice(1)).toEqual(mod.STREAM_SOURCES)
  })

  it('falls back to the plain list when opted in but unconfigured', async () => {
    const mod = await importWithEnv(BASE_ENV)
    expect(mod.visibleSourcesFor(true)).toEqual(mod.STREAM_SOURCES)
  })

  it('leaves the default journey untouched by the rich slot', async () => {
    const mod = await importWithEnv({
      ...BASE_ENV,
      NEXT_PUBLIC_STREAM_SOURCE_PRO: 'https://rich.example',
    })
    // Position 0 stays Server 1 for everyone; opting in must never move it.
    expect(mod.STREAM_SOURCES[0].id).toBe('a.example')
    expect(mod.DEFAULT_SOURCE_ID).toBe('a.example')
  })
})
