import { describe, expect, it } from 'vitest'

import { TRIAL_WINDOW_MS, trialStatus } from '@/lib/player-trial'

const now = 1_760_000_000_000

describe('trialStatus', () => {
  it('offers the trial to a browser that never used one', () => {
    expect(trialStatus(null, 'movie:550', now)).toBe('available')
  })

  it('keeps the title it was spent on, for the rest of the day', () => {
    const record = { key: 'movie:550', at: now - 60_000 }
    expect(trialStatus(record, 'movie:550', now)).toBe('active')
  })

  it('does not hand a second title out the same day', () => {
    const record = { key: 'movie:550', at: now - 60_000 }
    expect(trialStatus(record, 'series:1399', now)).toBe('used')
  })

  it('offers it again a day later', () => {
    const record = { key: 'movie:550', at: now - TRIAL_WINDOW_MS }
    expect(trialStatus(record, 'series:1399', now)).toBe('available')
    expect(trialStatus(record, 'movie:550', now)).toBe('available')
  })

  it('ignores a record dated in the future (clock moved back)', () => {
    const record = { key: 'movie:550', at: now + 60_000 }
    expect(trialStatus(record, 'series:1399', now)).toBe('available')
  })
})
