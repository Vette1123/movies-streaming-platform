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
import { latchTokens } from '@/hooks/use-frame-tokens'

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

describe('embed tokens', () => {
  // Positions and prefs sync through the account, but an embed keeps its own
  // only in its storage on the device that played, so on any other device it
  // started from zero and on its default subtitles. A slot whose provider
  // takes these names them with tokens.
  const resuming: StreamSource = {
    id: 'r',
    label: 'Server R',
    base: 'https://embed.example',
    query: 'primaryColor=63b8bc&startAt={start}&ds_lang={sub}',
  }

  it('fills {start} with the whole resume second and {sub} with the language', () => {
    expect(movieStreamUrl(resuming, 550, { start: 1834.7, sub: 'fr' })).toBe(
      'https://embed.example/movie/550?primaryColor=63b8bc&startAt=1834&ds_lang=fr'
    )
    expect(
      seriesStreamUrl(
        resuming,
        1396,
        { season: 2, episode: 3 },
        { start: 600, sub: 'ar' }
      )
    ).toBe(
      'https://embed.example/tv/1396/2/3?primaryColor=63b8bc&startAt=600&ds_lang=ar'
    )
  })

  it('drops a pair with nothing to send', () => {
    for (const start of [null, undefined, 0, Number.NaN]) {
      expect(movieStreamUrl(resuming, 550, { start, sub: 'en' })).toBe(
        'https://embed.example/movie/550?primaryColor=63b8bc&ds_lang=en'
      )
    }
    // "Off" is no preference: the provider's own default stands.
    for (const sub of [null, undefined, 'off', '<b>']) {
      expect(movieStreamUrl(resuming, 550, { start: 90, sub })).toBe(
        'https://embed.example/movie/550?primaryColor=63b8bc&startAt=90'
      )
    }
    const onlyTokens = { ...resuming, query: 'startAt={start}&sub={sub}' }
    expect(movieStreamUrl(onlyTokens, 550)).toBe(
      'https://embed.example/movie/550'
    )
  })

  it('ignores tokens on a slot that does not ask for them', () => {
    expect(
      movieStreamUrl({ ...resuming, query: 'primaryColor=63b8bc' }, 550, {
        start: 900,
        sub: 'fr',
      })
    ).toBe('https://embed.example/movie/550?primaryColor=63b8bc')
  })
})

describe('latchTokens', () => {
  // The tokens ride the frame URL. Read live, every position the progress
  // bridge wrote would re-point the iframe and restart the embed.
  const idle = { identity: null, tokens: null }

  it('reads once when a frame starts, then holds while it plays', () => {
    const read = vi.fn(() => ({ start: 600, sub: 'fr' }))
    const playing = latchTokens(idle, 'r:2:3', read)
    expect(playing.tokens).toEqual({ start: 600, sub: 'fr' })
    read.mockReturnValue({ start: 642, sub: 'fr' })
    expect(latchTokens(playing, 'r:2:3', read)).toBe(playing)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('reads again for a new episode or server, and nothing when idle', () => {
    const read = vi.fn(() => ({ start: 600 }))
    const first = latchTokens(idle, 'r:2:3', read)
    read.mockReturnValue({ start: 30 })
    expect(latchTokens(first, 'r:2:4', read).tokens).toEqual({ start: 30 })
    expect(latchTokens(first, null, read)).toEqual(idle)
    expect(read).toHaveBeenCalledTimes(2)
  })
})

describe('parseEmbedProgress, status-style players', () => {
  // A second player family reports `player_status` / `player_progress` /
  // `player_duration` (its own docs), every ~5s while playing. The parser
  // knew only `event: 'timeupdate'`, so nothing played on it was ever
  // remembered: no resume, and no tick when it finished.
  const status = (
    player_status: string,
    progress?: number,
    duration?: number
  ) => ({
    type: 'PLAYER_EVENT',
    data: {
      player_info: { tmdb: 1396, mediaType: 'tv', season: 2, episode: 3 },
      player_status,
      ...(progress !== undefined ? { player_progress: progress } : {}),
      ...(duration !== undefined ? { player_duration: duration } : {}),
    },
  })

  it('reads playing, paused and seeked as a position', () => {
    for (const state of ['playing', 'paused', 'seeked']) {
      expect(parseEmbedProgress(status(state, 754.2, 2820))).toEqual({
        kind: 'progress',
        positionSeconds: 754.2,
        durationSeconds: 2820,
      })
    }
  })

  it('reads completed as the end, in either nesting', () => {
    expect(parseEmbedProgress(status('completed', 2820, 2820))).toEqual({
      kind: 'ended',
      positionSeconds: 0,
    })
    const reposted = { type: 'PLAYER_EVENT', event: status('completed').data }
    expect(parseEmbedProgress(reposted)?.kind).toBe('ended')
  })

  it('refuses a status with no position', () => {
    expect(parseEmbedProgress(status('playing'))).toBeNull()
    expect(parseEmbedProgress(status('buffering', 10))).toBeNull()
  })
})
