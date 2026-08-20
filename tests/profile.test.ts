import { describe, expect, it } from 'vitest'

import { normaliseBio, normaliseHandle } from '@/lib/profile/routes'

/**
 * A handle is a permanent public URL, claimed once and never changed, so the
 * only place it can be rejected is here. Everything below is a shape that would
 * otherwise reach the database and be somebody's address for good.
 */
describe('normaliseHandle', () => {
  it('accepts a plain handle and lowercases it', () => {
    expect(normaliseHandle('gado')).toBe('gado')
    expect(normaliseHandle('  Gado  ')).toBe('gado')
    expect(normaliseHandle('MOHAMED-GADO')).toBe('mohamed-gado')
    expect(normaliseHandle('a1b2c3')).toBe('a1b2c3')
  })

  it('refuses lengths outside three to twenty', () => {
    expect(normaliseHandle('ab')).toBe(null)
    expect(normaliseHandle('a'.repeat(21))).toBe(null)
    expect(normaliseHandle('a'.repeat(20))).toBe('a'.repeat(20))
  })

  it('refuses a dash at either end, or two in a row', () => {
    // A leading dash reads as a flag in a shell, a trailing one runs into
    // whatever follows the URL, and a double dash is how one handle is made to
    // look like another.
    expect(normaliseHandle('-gado')).toBe(null)
    expect(normaliseHandle('gado-')).toBe(null)
    expect(normaliseHandle('ga--do')).toBe(null)
  })

  it('refuses anything that is not a letter, a digit or a dash', () => {
    for (const bad of [
      'ga do',
      'ga.do',
      'ga/do',
      'ga_do',
      'ga%2fdo',
      'gádo',
      '../etc',
      'ga\ndo',
    ]) {
      expect(normaliseHandle(bad)).toBe(null)
    }
  })

  it('refuses the names the site needs for itself', () => {
    for (const reserved of ['admin', 'Support', 'REELY', 'api', 'settings']) {
      expect(normaliseHandle(reserved)).toBe(null)
    }
  })

  it('refuses anything that is not a string', () => {
    for (const bad of [null, undefined, 42, {}, ['gado']]) {
      expect(normaliseHandle(bad)).toBe(null)
    }
  })
})

describe('normaliseBio', () => {
  it('collapses whitespace and trims', () => {
    expect(normaliseBio('  Horror,\n  mostly.  ')).toBe('Horror, mostly.')
  })

  it('caps at 160 characters', () => {
    expect(normaliseBio('x'.repeat(400))).toHaveLength(160)
  })

  it('treats an empty or blank line as no bio', () => {
    expect(normaliseBio('')).toBe(null)
    expect(normaliseBio('   \n\t ')).toBe(null)
    expect(normaliseBio(undefined)).toBe(null)
  })
})
