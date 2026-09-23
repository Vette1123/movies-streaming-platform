import { describe, expect, it } from 'vitest'

import {
  followHost,
  hostHref,
  inviteHref,
  planRemoteCommand,
  remoteHref,
  remoteView,
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
  const cmd = (
    over: Partial<Parameters<typeof planRemoteCommand>[0]> = {}
  ) => ({
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
    'https://reely.example/tv-shows/1399?season=2&episode=5&watch=ABCD12&host=1&rk=k3y'

  it('hostHref carries the room, the host flag and the key', () => {
    expect(hostHref('/tv-shows/1399', 'ABCD12', 'k3y')).toBe(
      '/tv-shows/1399?watch=ABCD12&host=1&rk=k3y'
    )
  })

  it('inviteHref keeps playback params and drops the host flag AND the key', () => {
    expect(inviteHref(href)).toBe(
      'https://reely.example/tv-shows/1399?season=2&episode=5&watch=ABCD12'
    )
  })

  it('inviteHref from the phone pad does not hand out the remote either', () => {
    expect(inviteHref(`${href}&remote=1`)).toBe(
      'https://reely.example/tv-shows/1399?season=2&episode=5&watch=ABCD12'
    )
  })

  it('remoteHref drops host, marks the remote and keeps the key', () => {
    expect(remoteHref(href)).toBe(
      'https://reely.example/tv-shows/1399?season=2&episode=5&watch=ABCD12&remote=1&rk=k3y'
    )
  })

  it('remoteHref is null for a room without a key', () => {
    expect(
      remoteHref('https://reely.example/movies/550?watch=ABCD12&host=1')
    ).toBeNull()
  })
})

describe('remoteView', () => {
  const row = {
    position: 100,
    playing: 1,
    updated_at: NOW - 3000,
    cmd_position: null,
    cmd_playing: null,
    cmd_at: null,
  }

  it('shows the beat when no command is pending', () => {
    expect(remoteView(row, NOW)).toEqual({ position: 100, playing: true })
  })

  it('shows a command the host has not drained yet', () => {
    const state = {
      ...row,
      cmd_position: 110,
      cmd_playing: 0,
      cmd_at: NOW - 1000,
    }
    expect(remoteView(state, NOW)).toEqual({ position: 110, playing: false })
  })

  it('lets a newer beat win over an older command', () => {
    const state = {
      ...row,
      updated_at: NOW - 500,
      cmd_position: 110,
      cmd_playing: 0,
      cmd_at: NOW - 1000,
    }
    expect(remoteView(state, NOW)).toEqual({ position: 100, playing: true })
  })

  it('drops a command that went stale undrained', () => {
    const state = {
      ...row,
      updated_at: NOW - STALE_BEAT_MS - 5000,
      cmd_position: 110,
      cmd_playing: 0,
      cmd_at: NOW - STALE_BEAT_MS - 1,
    }
    expect(remoteView(state, NOW)).toEqual({ position: 100, playing: true })
  })
})
