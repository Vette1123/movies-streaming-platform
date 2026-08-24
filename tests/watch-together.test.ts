import { describe, expect, it } from 'vitest'

import { followHost, STALE_BEAT_MS } from '@/lib/watch-together'

const NOW = 1_700_000_000_000
const fresh = (over: Partial<Parameters<typeof followHost>[0]> = {}) => ({
  position: 100,
  playing: true,
  updatedAt: NOW - 2000,
  ...over,
})

describe('followHost', () => {
  it('leaves a guest alone while they are in step', () => {
    expect(
      followHost(fresh(), { position: 101.5, playing: true }, NOW)
    ).toBeNull()
  })

  it('pulls a guest back once they drift past the tolerance', () => {
    expect(followHost(fresh(), { position: 130, playing: true }, NOW)).toEqual({
      position: 100,
      playing: true,
    })
  })

  it('follows a pause the host made in place', () => {
    // Zero drift: only the play state changed, which is exactly the case a
    // drift check alone sails straight past.
    expect(
      followHost(
        fresh({ playing: false }),
        { position: 100, playing: true },
        NOW
      )
    ).toEqual({ position: 100, playing: false })
  })

  it('ignores a playing beat from a host who stopped beating', () => {
    const gone = fresh({ updatedAt: NOW - STALE_BEAT_MS - 1 })
    // Without this the guest is yanked back to the host's frozen position
    // every four seconds, forever.
    expect(followHost(gone, { position: 400, playing: true }, NOW)).toBeNull()
  })

  it('still follows a stale PAUSE, because a paused host stops beating', () => {
    const paused = fresh({ playing: false, updatedAt: NOW - STALE_BEAT_MS - 1 })
    expect(followHost(paused, { position: 100, playing: true }, NOW)).toEqual({
      position: 100,
      playing: false,
    })
  })

  it('goes on position alone when the guest player reports nothing', () => {
    // An embed that publishes no progress leaves `mine` null forever.
    expect(followHost(fresh(), null, NOW)).toEqual({
      position: 100,
      playing: true,
    })
    expect(followHost(fresh({ position: 1 }), null, NOW)).toBeNull()
  })
})
