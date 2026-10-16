import { describe, expect, it } from 'vitest'

import { resumeShare } from '@/lib/playback-positions'

const at = (position: number, duration?: number) => ({
  position_seconds: position,
  duration_seconds: duration,
  updated_at: '2026-10-16T00:00:00Z',
})

describe('resumeShare', () => {
  it('is the share watched, off the reported duration', () => {
    expect(resumeShare(at(600, 2400))).toBe(0.25)
  })

  it('falls back to the TMDB runtime when no duration was reported', () => {
    expect(resumeShare(at(1200), 40)).toBe(0.5)
  })

  it('draws no bar where there is nothing to resume', () => {
    expect(resumeShare(null, 40)).toBeNull()
    expect(resumeShare(at(10, 2400))).toBeNull() // barely started
    expect(resumeShare(at(2350, 2400))).toBeNull() // in the credits: finished
    expect(resumeShare(at(600))).toBeNull() // no length known at all
  })
})
