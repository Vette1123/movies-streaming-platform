import { afterEach, describe, expect, it } from 'vitest'

import { storageGet, storageSet } from '@/lib/safe-storage'

const g = globalThis as unknown as { window?: unknown }

afterEach(() => {
  delete g.window
})

describe('safe storage', () => {
  it('reads null when Safari hands back a null localStorage', () => {
    g.window = { localStorage: null }
    expect(storageGet('k')).toBeNull()
    expect(() => storageSet('k', 'v')).not.toThrow()
  })

  it('swallows a throwing store', () => {
    g.window = {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError')
        },
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
      },
    }
    expect(storageGet('k')).toBeNull()
    expect(() => storageSet('k', 'v')).not.toThrow()
  })

  it('round-trips through a working store', () => {
    const map = new Map<string, string>()
    g.window = {
      localStorage: {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
      },
    }
    storageSet('k', 'v')
    expect(storageGet('k')).toBe('v')
  })
})
