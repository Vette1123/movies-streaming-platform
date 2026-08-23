import { afterEach, describe, expect, it, vi } from 'vitest'

// config/sources.ts reads its env at module init, so each scenario re-imports
// it under a fresh process.env. Next inlines these textually for the app build
// — what is under test here is the PARSING and the opt-in list contract.
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

describe('RICH_SOURCE (the supporters-only self-host trial)', () => {
  afterEach(() => {
    vi.resetModules()
  })

  it('is null when the trial flag is unset', async () => {
    const mod = await importWithEnv(BASE_ENV)
    expect(mod.RICH_SOURCE).toBeNull()
  })

  it('is null unless the flag is exactly true', async () => {
    const mod = await importWithEnv({
      ...BASE_ENV,
      NEXT_PUBLIC_PRO_TRIAL_SELFHOST: '1',
    })
    expect(mod.RICH_SOURCE).toBeNull()
  })

  it('is our own player surface when enabled', async () => {
    const mod = await importWithEnv({
      ...BASE_ENV,
      NEXT_PUBLIC_PRO_TRIAL_SELFHOST: 'true',
    })
    expect(mod.RICH_SOURCE).toEqual({
      id: mod.REELY_SOURCE_ID,
      label: 'Reely Beta',
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
      NEXT_PUBLIC_PRO_TRIAL_SELFHOST: 'true',
    })
    expect(mod.visibleSourcesFor(false)).toEqual(mod.STREAM_SOURCES)
  })

  it('leads with our player first for opted-in supporters', async () => {
    const mod = await importWithEnv({
      ...BASE_ENV,
      NEXT_PUBLIC_PRO_TRIAL_SELFHOST: 'true',
    })
    const list = mod.visibleSourcesFor(true)
    expect(list[0].id).toBe(mod.REELY_SOURCE_ID)
    expect(list.slice(1)).toEqual(mod.STREAM_SOURCES)
  })

  it('falls back to the plain list when opted in but unconfigured', async () => {
    const mod = await importWithEnv(BASE_ENV)
    expect(mod.visibleSourcesFor(true)).toEqual(mod.STREAM_SOURCES)
  })

  it('leaves the default journey untouched by the trial', async () => {
    const mod = await importWithEnv({
      ...BASE_ENV,
      NEXT_PUBLIC_PRO_TRIAL_SELFHOST: 'true',
    })
    expect(mod.STREAM_SOURCES[0].id).toBe('a.example')
    expect(mod.DEFAULT_SOURCE_ID).toBe('a.example')
  })
})
