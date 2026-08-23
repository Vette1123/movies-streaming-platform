import { describe, expect, it } from 'vitest'

import {
  movieStreamUrl,
  seriesStreamUrl,
  type StreamSource,
} from '@/config/sources'
import {
  MIN_WRITE_DELTA_SECONDS,
  parseEmbedProgress,
  shouldWriteEmbedProgress,
} from '@/lib/embed-progress'

describe('parseEmbedProgress', () => {
  const timeupdate = (currentTime: number, duration?: number) => ({
    type: 'PLAYER_EVENT',
    data: {
      event: 'timeupdate',
      currentTime,
      ...(duration !== undefined ? { duration } : {}),
    },
  })

  it('parses a valid timeupdate into a progress report', () => {
    expect(parseEmbedProgress(timeupdate(31.4, 3609.8))).toEqual({
      kind: 'progress',
      positionSeconds: 31.4,
      durationSeconds: 3609.8,
    })
  })

  it('omits duration when absent, zero, or non-finite', () => {
    expect(parseEmbedProgress(timeupdate(10))).toEqual({
      kind: 'progress',
      positionSeconds: 10,
    })
    expect(
      parseEmbedProgress(timeupdate(10, 0))?.durationSeconds
    ).toBeUndefined()
    expect(
      parseEmbedProgress(timeupdate(10, Number.NaN))?.durationSeconds
    ).toBeUndefined()
  })

  it('parses ended without requiring a position', () => {
    expect(
      parseEmbedProgress({ type: 'PLAYER_EVENT', data: { event: 'ended' } })
    ).toEqual({
      kind: 'ended',
      positionSeconds: 0,
    })
  })

  it('rejects other player events and malformed envelopes', () => {
    expect(
      parseEmbedProgress({ type: 'PLAYER_EVENT', data: { event: 'play' } })
    ).toBeNull()
    expect(
      parseEmbedProgress({ type: 'PLAYER_EVENT', data: { event: 'seeked' } })
    ).toBeNull()
    expect(parseEmbedProgress({ type: 'MEDIA_DATA', data: {} })).toBeNull()
    expect(parseEmbedProgress({ data: { event: 'timeupdate' } })).toBeNull()
    expect(parseEmbedProgress(null)).toBeNull()
    expect(parseEmbedProgress('PLAYER_EVENT')).toBeNull()
  })

  it('rejects timeupdates whose position is missing or unusable', () => {
    expect(
      parseEmbedProgress({
        type: 'PLAYER_EVENT',
        data: { event: 'timeupdate' },
      })
    ).toBeNull()
    expect(
      parseEmbedProgress({
        type: 'PLAYER_EVENT',
        data: { event: 'timeupdate', currentTime: '12' },
      })
    ).toBeNull()
    expect(
      parseEmbedProgress({
        type: 'PLAYER_EVENT',
        data: { event: 'timeupdate', currentTime: -3 },
      })
    ).toBeNull()
  })
})

describe('shouldWriteEmbedProgress', () => {
  it('writes the first report', () => {
    expect(shouldWriteEmbedProgress(2, null)).toBe(true)
  })

  it(`skips movement under ${MIN_WRITE_DELTA_SECONDS}s`, () => {
    expect(shouldWriteEmbedProgress(7, 5)).toBe(false)
    expect(shouldWriteEmbedProgress(5 + MIN_WRITE_DELTA_SECONDS - 0.1, 5)).toBe(
      false
    )
  })

  it(`writes once movement reaches ${MIN_WRITE_DELTA_SECONDS}s`, () => {
    expect(shouldWriteEmbedProgress(5 + MIN_WRITE_DELTA_SECONDS, 5)).toBe(true)
  })

  it('treats a backwards jump (seek) as movement', () => {
    expect(shouldWriteEmbedProgress(30, 600)).toBe(true)
  })
})

describe('source query passthrough', () => {
  const base: StreamSource = {
    id: 'x',
    label: 'Server X',
    base: 'https://embed.example',
  }
  const branded: StreamSource = {
    ...base,
    query: 'primaryColor=63b8bc&autoplay=true',
  }

  it('appends the slot query to movie URLs', () => {
    expect(movieStreamUrl(branded, 550)).toBe(
      'https://embed.example/movie/550?primaryColor=63b8bc&autoplay=true'
    )
  })

  it('appends the slot query after episode segments', () => {
    expect(seriesStreamUrl(branded, 94605, { season: 2, episode: 1 })).toBe(
      'https://embed.example/tv/94605/2/1?primaryColor=63b8bc&autoplay=true'
    )
    // Series roots normalize to the first episode.
    expect(seriesStreamUrl(branded, 94605, null)).toBe(
      'https://embed.example/tv/94605/1/1?primaryColor=63b8bc&autoplay=true'
    )
  })

  it('leaves plain sources untouched', () => {
    expect(movieStreamUrl(base, 550)).toBe('https://embed.example/movie/550')
  })
})
