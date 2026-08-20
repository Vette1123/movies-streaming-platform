import { describe, expect, it } from 'vitest'

import { monthlyEquivalent } from '@/config/support'
import {
  cardPosters,
  SUPPORTER_FLOOR,
  supporterLine,
} from '@/lib/community/routes'
import { RESCUE_MIN_ITEMS, rescueLine, shouldOfferRescue } from '@/lib/rescue'

describe('cardPosters', () => {
  it('counts the whole list but keeps only a strip of posters', () => {
    const items = JSON.stringify(
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        poster_path: `/p${i}.jpg`,
      }))
    )
    const card = cardPosters(items)
    expect(card.count).toBe(20)
    expect(card.posters).toHaveLength(5)
  })

  it('survives a row written by an older client, or by hand', () => {
    // One malformed row must not take down the directory that lists everybody
    // else's.
    expect(cardPosters('not json')).toEqual({ count: 0, posters: [] })
    expect(cardPosters('{"nope":1}')).toEqual({ count: 0, posters: [] })
    expect(cardPosters('[{"id":1},{"id":2,"poster_path":null}]')).toEqual({
      count: 2,
      posters: [],
    })
  })
})

describe('supporterLine', () => {
  it('says nothing countable until the number helps', () => {
    // "3 supporters" reads as a dead site and argues against itself.
    expect(supporterLine(3)).not.toMatch(/\d/)
    expect(supporterLine(SUPPORTER_FLOOR - 1)).not.toMatch(/\d/)
  })

  it('counts once there is something worth counting', () => {
    expect(supporterLine(412)).toBe('412 people keep Reely free for everyone.')
  })
})

describe('shouldOfferRescue', () => {
  const many = { saved: 4, history: 3, finished: 9 }

  it('never warns somebody whose library is already on their account', () => {
    expect(shouldOfferRescue(many, true, false)).toBe(false)
  })

  it('warns a signed-out browser holding enough to lose', () => {
    expect(shouldOfferRescue(many, false, false)).toBe(true)
    expect(shouldOfferRescue(many, undefined, false)).toBe(true)
  })

  it('stays quiet below the floor, and after a no', () => {
    expect(
      shouldOfferRescue({ saved: 1, history: 0, finished: 0 }, false, false)
    ).toBe(false)
    expect(RESCUE_MIN_ITEMS).toBeGreaterThan(1)
    expect(shouldOfferRescue(many, false, true)).toBe(false)
  })
})

describe('rescueLine', () => {
  it('names only the stores that actually have something in them', () => {
    expect(rescueLine({ saved: 12, history: 0, finished: 0 })).toBe(
      '12 saved titles — in this browser only.'
    )
    expect(rescueLine({ saved: 1, history: 0, finished: 1 })).toBe(
      '1 saved title and 1 episode or film ticked off — in this browser only.'
    )
  })

  it('joins three clauses without a comma splice', () => {
    expect(rescueLine({ saved: 2, history: 3, finished: 4 })).toBe(
      '2 saved titles, 4 episodes and films ticked off and 3 titles in your history — in this browser only.'
    )
  })
})

describe('monthlyEquivalent', () => {
  it('keeps the cents, because $4 is a price that does not exist', () => {
    expect(monthlyEquivalent(50)).toBe('$4.17')
    expect(monthlyEquivalent(60)).toBe('$5.00')
  })
})
