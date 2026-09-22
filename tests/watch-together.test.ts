import { describe, expect, it } from 'vitest'

import {
  followHost,
  inviteHref,
  planRemoteCommand,
  remoteHref,
  STALE_BEAT_MS,
} from '@/lib/watch-together'

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

describe('planRemoteCommand', () => {
  const cmd = (over: Partial<Parameters<typeof planRemoteCommand>[0]> = {}) => ({
    position: 120,
    playing: false,
    updatedAt: NOW - 500,
    ...over,
  })

  it('applies a fresh command the host has not drained yet', () => {
    expect(planRemoteCommand(cmd(), 0, NOW)).toEqual({
      position: 120,
      playing: false,
    })
  })

  it('drops a command the host already applied', () => {
    expect(planRemoteCommand(cmd(), NOW, NOW)).toBeNull()
    expect(planRemoteCommand(cmd(), NOW + 1, NOW)).toBeNull()
  })

  it('drops a command older than the stale window (hidden host tab)', () => {
    // The phone pressed something, the host tab sat hidden past STALE_BEAT_MS,
    // and rewinding playback now would be a surprise, not a feature.
    const late = cmd({ updatedAt: NOW - STALE_BEAT_MS - 1 })
    expect(planRemoteCommand(late, 0, NOW)).toBeNull()
  })

  it('drops a null command', () => {
    expect(planRemoteCommand(null, 0, NOW)).toBeNull()
  })
})

describe('room hrefs', () => {
  const href =
    'https://reely.example/tv-shows/1399?season=2&episode=5&watch=ABCD12&host=1'

  it('inviteHref keeps playback params and drops the host flag', () => {
    expect(inviteHref(href)).toBe(
      'https://reely.example/tv-shows/1399?season=2&episode=5&watch=ABCD12'
    )
  })

  it('remoteHref drops host and marks the URL as a remote', () => {
    expect(remoteHref(href)).toBe(
      'https://reely.example/tv-shows/1399?season=2&episode=5&watch=ABCD12&remote=1'
    )
  })
})
