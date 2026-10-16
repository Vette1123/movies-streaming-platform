import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isFinishedAt, resumableSeconds } from '@/lib/playback-positions'
import {
  cleanPrefs,
  prefsFromPlayer,
  readPlaybackPrefs,
} from '@/lib/playback-prefs'

// A preference is only a preference if the next boot gets it. These pin the
// two places that decided otherwise: which copy wins when the device and the
// account disagree, and what a message from the player is allowed to set.

const memoryStorage = () => {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

beforeEach(() => {
  vi.stubGlobal('window', { localStorage: memoryStorage() })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readPlaybackPrefs', () => {
  it('takes the account over a stale device mirror', () => {
    // Picked Arabic on this phone once; English everywhere since.
    window.localStorage.setItem(
      'reely_playback_prefs',
      JSON.stringify({ sub: 'ar', quality: 480 })
    )
    expect(readPlaybackPrefs({ sub: 'en', quality: 1080 })).toMatchObject({
      sub: 'en',
      quality: 1080,
    })
  })

  it('falls back to the mirror with no account answer', () => {
    window.localStorage.setItem(
      'reely_playback_prefs',
      JSON.stringify({ sub: 'fr', subSize: 'l' })
    )
    expect(readPlaybackPrefs(null)).toMatchObject({ sub: 'fr', subSize: 'l' })
  })

  it('fills a field the account never set from the mirror', () => {
    window.localStorage.setItem(
      'reely_playback_prefs',
      JSON.stringify({ quality: 720 })
    )
    expect(readPlaybackPrefs({ sub: 'en' })).toMatchObject({
      sub: 'en',
      quality: 720,
    })
  })
})

describe('prefsFromPlayer', () => {
  it('takes a subtitle language and a quality rung', () => {
    expect(prefsFromPlayer({ sub: 'es' })).toEqual({ sub: 'es' })
    expect(prefsFromPlayer({ sub: 'off' })).toEqual({ sub: 'off' })
    expect(prefsFromPlayer({ quality: 1080 })).toEqual({ quality: 1080 })
  })

  it('reads quality 0 as going back to Auto', () => {
    const patch = prefsFromPlayer({ quality: 0 })
    expect(patch).not.toBeNull()
    expect(patch).toHaveProperty('quality', undefined)
  })

  it('refuses anything it cannot name', () => {
    expect(prefsFromPlayer({})).toBeNull()
    expect(prefsFromPlayer({ sub: '<script>' })).toBeNull()
    expect(prefsFromPlayer({ sub: 42, quality: 881 })).toBeNull()
    expect(prefsFromPlayer({ quality: '1080' })).toBeNull()
    expect(prefsFromPlayer({ audio: 'Italian', miniBar: 'yes' })).toBeNull()
  })

  it('takes an audio language and the full-screen bar switch', () => {
    // Both used to be dropped: an audio pick lasted one episode, and the bar
    // switch inside the player never left this device.
    expect(prefsFromPlayer({ audio: 'it' })).toEqual({ audio: 'it' })
    expect(prefsFromPlayer({ miniBar: false })).toEqual({ miniBar: false })
    expect(prefsFromPlayer({ miniBar: true })).toEqual({ miniBar: true })
  })
})

describe('cleanPrefs', () => {
  it('keeps an explicit "bar off", so the account can say it', () => {
    expect(cleanPrefs({ miniBar: false })).toHaveProperty('miniBar', false)
    expect(cleanPrefs({})).not.toHaveProperty('miniBar')
  })

  it('keeps a valid audio language and drops a malformed one', () => {
    expect(cleanPrefs({ audio: 'it' })).toHaveProperty('audio', 'it')
    expect(cleanPrefs({ audio: 'Italian' })).not.toHaveProperty('audio')
  })
})

describe('readPlaybackPrefs audio', () => {
  it('takes the account audio over the device mirror', () => {
    window.localStorage.setItem(
      'reely_playback_prefs',
      JSON.stringify({ audio: 'en' })
    )
    expect(readPlaybackPrefs({ audio: 'it' }).audio).toBe('it')
    expect(readPlaybackPrefs(null).audio).toBe('en')
  })
})

describe('isFinishedAt', () => {
  it('counts the credits as watched', () => {
    expect(isFinishedAt(2700 * 0.96, 2700)).toBe(true)
    expect(isFinishedAt(2700 * 0.9, 2700)).toBe(false)
  })

  it('never decides without a duration', () => {
    expect(isFinishedAt(5000, undefined)).toBe(false)
    expect(isFinishedAt(5000, 0)).toBe(false)
  })

  it('agrees with resume: a finished title has nothing to resume', () => {
    const entry = { position_seconds: 2650, updated_at: '' }
    expect(isFinishedAt(2650, 2700)).toBe(true)
    expect(resumableSeconds(entry, 2700)).toBeNull()
    expect(resumableSeconds({ ...entry, position_seconds: 600 }, 2700)).toBe(
      600
    )
  })
})
