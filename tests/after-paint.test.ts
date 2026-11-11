import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { afterNextPaint } from '@/lib/after-paint'

// Watch Now used to start playback inside its click handler, so the frame INP
// measures carried the whole swap: hero copy out, player stage in, iframe
// created. Field p75 for that target was 620-692ms on phones. The press must
// paint first and the swap run in the task after it.
describe('afterNextPaint', () => {
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

  it('never runs the work inside the event that asked for it', () => {
    const work = vi.fn()
    afterNextPaint(work)
    expect(work).not.toHaveBeenCalled()
  })

  it('runs the work in the task after the next frame, not in the frame', () => {
    const work = vi.fn()
    afterNextPaint(work)
    for (const f of frames.splice(0)) f(0)
    // Still inside the frame's rendering steps: the paint has not happened.
    expect(work).not.toHaveBeenCalled()
    vi.advanceTimersByTime(0)
    expect(work).toHaveBeenCalledTimes(1)
  })

  it('still runs, once, when no frame comes (a hidden tab)', () => {
    const work = vi.fn()
    afterNextPaint(work)
    vi.advanceTimersByTime(200)
    expect(work).toHaveBeenCalledTimes(1)
    for (const f of frames.splice(0)) f(0)
    vi.advanceTimersByTime(200)
    expect(work).toHaveBeenCalledTimes(1)
  })
})
