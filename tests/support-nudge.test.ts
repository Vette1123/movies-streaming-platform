import { describe, expect, it } from 'vitest'

import {
  shouldArmOnPlay,
  shouldNudge,
  shouldShowArmed,
} from '@/lib/support-nudge'

/**
 * The one place Reely asks for money without being asked first. Everything else
 * is a link somebody chooses to follow, so the rules here — once, never to a
 * supporter, and only after real use — are the ones worth pinning down.
 */
const at = (
  savedCount: number,
  extra: Partial<Parameters<typeof shouldNudge>[0]> = {}
) => shouldNudge({ savedCount, pro: false, alreadyNudged: false, ...extra })

describe('shouldNudge', () => {
  it('waits until the third save', () => {
    expect(at(1)).toBe(false)
    expect(at(2)).toBe(false)
    expect(at(3)).toBe(true)
  })

  it('never asks a supporter', () => {
    expect(at(3, { pro: true })).toBe(false)
  })

  it('asks once and never again', () => {
    expect(at(3, { alreadyNudged: true })).toBe(false)
  })

  it('does not re-ask somebody who is already past the threshold', () => {
    // The flag is what normally stops this, but a cleared browser has no flag
    // and can still have a long watchlist — a `>=` here would ask them on their
    // very next save.
    expect(at(4)).toBe(false)
    expect(at(40)).toBe(false)
  })

  it('ignores a watchlist that has gone backwards', () => {
    expect(at(0)).toBe(false)
    expect(at(-1)).toBe(false)
  })
})

/**
 * The play trigger. A third saved title reached two people in 38 days; the
 * third play is where most visitors actually are.
 */
describe('shouldArmOnPlay', () => {
  const play = (
    playCount: number,
    extra: Partial<Parameters<typeof shouldArmOnPlay>[0]> = {}
  ) =>
    shouldArmOnPlay({ playCount, pro: false, alreadyNudged: false, ...extra })

  it('arms on the third play, not before or after', () => {
    expect(play(2)).toBe(false)
    expect(play(3)).toBe(true)
    expect(play(4)).toBe(false)
  })

  it('never arms for a supporter, or after the one ask was spent', () => {
    expect(play(3, { pro: true })).toBe(false)
    expect(play(3, { alreadyNudged: true })).toBe(false)
  })
})

describe('shouldShowArmed', () => {
  const show = (extra: Partial<Parameters<typeof shouldShowArmed>[0]> = {}) =>
    shouldShowArmed({
      armed: true,
      alreadyNudged: false,
      pro: false,
      playerOpen: false,
      ...extra,
    })

  it('speaks once armed and nothing is playing', () => {
    expect(show()).toBe(true)
  })

  it('never speaks over a playing title', () => {
    expect(show({ playerOpen: true })).toBe(false)
  })

  it('stays quiet unarmed, already asked, or for a supporter', () => {
    expect(show({ armed: false })).toBe(false)
    expect(show({ alreadyNudged: true })).toBe(false)
    expect(show({ pro: true })).toBe(false)
  })
})
