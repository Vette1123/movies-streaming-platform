import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startEpisode } from '@/lib/start-episode'

// An episode card used to swap the player in inside its click handler, the
// bug Watch Now lost on 11 Nov (lib/after-paint.ts). Field mobile INP on that
// card after the Watch Now fix: p75 4.5s. The tap must paint first.
describe('startEpisode', () => {
  let frames: FrameRequestCallback[]

  beforeEach(() => {
    vi.useFakeTimers()
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frames.push(cb)
      return frames.length
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('starts nothing inside the tap', () => {
    const calls: string[] = []
    startEpisode(
      { season: 2, episode: 5 },
      {
        play: () => calls.push('play'),
        navigate: () => calls.push('navigate'),
        scroll: () => calls.push('scroll'),
      }
    )
    expect(calls).toEqual([])
  })

  it('plays, then points the URL, then scrolls, after the next paint', () => {
    const calls: string[] = []
    startEpisode(
      { season: 2, episode: 5 },
      {
        play: (t) => calls.push(`play ${t.season}x${t.episode}`),
        navigate: (t) => calls.push(`navigate ${t.season}x${t.episode}`),
        scroll: () => calls.push('scroll'),
      }
    )
    for (const f of frames.splice(0)) f(0)
    vi.advanceTimersByTime(0)
    expect(calls).toEqual(['play 2x5', 'navigate 2x5', 'scroll'])
  })
})
