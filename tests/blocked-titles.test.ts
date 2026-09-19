import { describe, expect, it } from 'vitest'

import {
  BLOCKED_TITLES,
  blockedTitleEntry,
  isTitleBlocked,
} from '@/lib/blocked-titles'

// This is exactly the class of logic the suite exists for: it is invisible when
// it breaks. A blocked title that quietly starts playing again looks like
// nothing on screen, and the first party to notice is the one who sent the
// notice.
describe('blocked titles', () => {
  it('blocks a reported title', () => {
    expect(isTitleBlocked('movie', 969681)).toBe(true)
  })

  it('treats a string id the same as a number', () => {
    // Route params arrive as strings and TMDB ids arrive as numbers. If these
    // disagreed, one half of the site would keep playing a title the other half
    // reports as removed.
    expect(isTitleBlocked('movie', '969681')).toBe(true)
  })

  it('does not block the same id under the other media type', () => {
    expect(isTitleBlocked('tv', 969681)).toBe(false)
  })

  it('leaves everything else playable', () => {
    expect(isTitleBlocked('movie', 550)).toBe(false)
    expect(isTitleBlocked('tv', 71)).toBe(false)
  })

  it('is safe against missing and malformed ids', () => {
    expect(isTitleBlocked('movie', null)).toBe(false)
    expect(isTitleBlocked('movie', undefined)).toBe(false)
    expect(isTitleBlocked('movie', '')).toBe(false)
    expect(isTitleBlocked('movie', 'not-a-number')).toBe(false)
    expect(isTitleBlocked('movie', NaN)).toBe(false)
  })

  it('does not match on a numeric prefix', () => {
    // `96968` must not inherit `969681`'s block, which a substring or
    // startsWith comparison would do.
    expect(isTitleBlocked('movie', 96968)).toBe(false)
    expect(isTitleBlocked('movie', 9696810)).toBe(false)
  })

  it('returns the entry so a reply can cite the report', () => {
    const entry = blockedTitleEntry('movie', 969681)
    expect(entry?.reportId).toBe('7e170169c822f2f4')
    expect(entry?.complainant).toContain('BREIN')
  })

  it('returns nothing for a title that is not blocked', () => {
    expect(blockedTitleEntry('movie', 550)).toBeUndefined()
  })

  // Every entry is evidence that removal was expeditious. A blank date or a
  // missing reference is the field you need and do not have when somebody asks
  // when you acted.
  it('every entry carries the fields a reply needs', () => {
    for (const entry of BLOCKED_TITLES) {
      expect(entry.type === 'movie' || entry.type === 'tv').toBe(true)
      expect(Number.isInteger(entry.id)).toBe(true)
      expect(entry.title.length).toBeGreaterThan(0)
      expect(entry.reportId.length).toBeGreaterThan(0)
      expect(entry.complainant.length).toBeGreaterThan(0)
      expect(entry.reportedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('has no duplicate entries', () => {
    const keys = BLOCKED_TITLES.map((e) => `${e.type}:${e.id}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
