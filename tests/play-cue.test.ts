import { describe, expect, it } from 'vitest'

import { playCue } from '@/lib/play-cue'

describe('playCue', () => {
  it('names a film plainly', () => {
    expect(playCue({ title: 'Heat' })).toEqual({
      text: 'Watch Now',
      label: 'Watch Heat',
    })
  })

  it('shows the episode a resume will start, not just in the label', () => {
    expect(
      playCue({
        title: 'Breaking Bad',
        target: { season: 2, episode: 3 },
        isResume: true,
      })
    ).toEqual({
      text: 'Resume S2 · E3',
      label: 'Resume Breaking Bad, season 2 episode 3',
    })
  })

  it('does not call a finished episode’s successor a resume', () => {
    const cue = playCue({
      title: 'Breaking Bad',
      target: { season: 2, episode: 4 },
      isResume: true,
      isNext: true,
    })
    expect(cue.text).toBe('Watch S2 · E4')
    expect(cue.label).toMatch(/^Watch .*season 2 episode 4$/)
  })

  it('says Watch for an episode the URL named', () => {
    expect(
      playCue({ title: 'Lost', target: { season: 1, episode: 5 } }).text
    ).toBe('Watch S1 · E5')
  })
})
