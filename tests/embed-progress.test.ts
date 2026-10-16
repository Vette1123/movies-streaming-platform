import { describe, expect, it, vi } from 'vitest'

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
import { latchStart } from '@/hooks/use-frame-start'

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

  // What actually crosses an origin boundary. The provider's inner player
  // posts the payload under `data` to the page framing it; that page re-posts
  // it to US under `event`. Read from their bundle and measured against a live
  // embed on 2026-09-06 — the `data` shape never leaves their own document, so
  // this is the only one a reely.space listener ever sees.
  const crossOrigin = (payload: Record<string, unknown>) => ({
    type: 'PLAYER_EVENT',
    event: { ...payload, video_id: '170060' },
  })

  it('parses a timeupdate that arrived under `event` rather than `data`', () => {
    expect(
      parseEmbedProgress(
        crossOrigin({
          event: 'timeupdate',
          currentTime: 31.4,
          duration: 3609.8,
        })
      )
    ).toEqual({
      kind: 'progress',
      positionSeconds: 31.4,
      durationSeconds: 3609.8,
    })
  })

  it('parses an end that arrived under `event`, by either name', () => {
    expect(parseEmbedProgress(crossOrigin({ event: 'ended' }))).toEqual({
      kind: 'ended',
      positionSeconds: 0,
    })
    // JWPlayer, which is what sits inside these embeds, calls it `complete`.
    expect(parseEmbedProgress(crossOrigin({ event: 'complete' }))).toEqual({
      kind: 'ended',
      positionSeconds: 0,
    })
  })

  it('still rejects the other events that ride the same envelope', () => {
    expect(
      parseEmbedProgress(crossOrigin({ event: 'pause', data: {} }))
    ).toBeNull()
    expect(
      parseEmbedProgress(crossOrigin({ event: 'play', data: {} }))
    ).toBeNull()
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

describe('embed start time', () => {
  // Positions sync through the account, but an embed's own progress lives in
  // its storage on the device that played, so on any other device it started
  // from zero. A slot whose provider takes a start time names it with {start}.
  const resuming: StreamSource = {
    id: 'r',
    label: 'Server R',
    base: 'https://embed.example',
    query: 'primaryColor=63b8bc&startAt={start}',
  }

  it('fills {start} with the whole resume second', () => {
    expect(movieStreamUrl(resuming, 550, 1834.7)).toBe(
      'https://embed.example/movie/550?primaryColor=63b8bc&startAt=1834'
    )
    expect(
      seriesStreamUrl(resuming, 1396, { season: 2, episode: 3 }, 600)
    ).toBe('https://embed.example/tv/1396/2/3?primaryColor=63b8bc&startAt=600')
  })

  it('drops the pair when there is nothing to resume', () => {
    for (const start of [null, undefined, 0, Number.NaN]) {
      expect(movieStreamUrl(resuming, 550, start)).toBe(
        'https://embed.example/movie/550?primaryColor=63b8bc'
      )
    }
    const onlyStart = { ...resuming, query: 'startAt={start}' }
    expect(movieStreamUrl(onlyStart, 550)).toBe(
      'https://embed.example/movie/550'
    )
  })

  it('ignores a start on a slot that does not ask for one', () => {
    expect(
      movieStreamUrl({ ...resuming, query: 'primaryColor=63b8bc' }, 550, 900)
    ).toBe('https://embed.example/movie/550?primaryColor=63b8bc')
  })
})

describe('latchStart', () => {
  // The start rides the frame URL. Read live, every position the progress
  // bridge wrote would re-point the iframe and restart the embed.
  const idle = { identity: null, start: null }

  it('reads once when a frame starts, then holds while it plays', () => {
    const read = vi.fn(() => 600)
    const playing = latchStart(idle, 'r:2:3', read)
    expect(playing.start).toBe(600)
    read.mockReturnValue(642)
    expect(latchStart(playing, 'r:2:3', read)).toBe(playing)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('reads again for a new episode or server, and nothing when idle', () => {
    const read = vi.fn(() => 600)
    const first = latchStart(idle, 'r:2:3', read)
    read.mockReturnValue(30)
    expect(latchStart(first, 'r:2:4', read).start).toBe(30)
    expect(latchStart(first, null, read)).toEqual(idle)
    expect(read).toHaveBeenCalledTimes(2)
  })
})
