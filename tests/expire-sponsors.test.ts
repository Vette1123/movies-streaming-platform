import { describe, expect, it } from 'vitest'
import { stripExpired } from '../scripts/expire-sponsors.mjs'

const README = [
  '## Supporting the project',
  '',
  '<!-- sponsor:acme until=2026-12-13T12:00:00Z -->',
  'Sponsored by Acme.',
  '<!-- /sponsor:acme -->',
  '',
  '## Tech stack',
  '',
].join('\n')

describe('stripExpired', () => {
  it('keeps a mention until its until instant', () => {
    const r = stripExpired(README, Date.parse('2026-12-13T11:59:59Z'))
    expect(r.text).toBe(README)
    expect(r.kept.map((k) => k.id)).toEqual(['acme'])
  })

  it('removes the mention and its blank line once it has ended', () => {
    const r = stripExpired(README, Date.parse('2026-12-13T12:00:00Z'))
    expect(r.text).toBe('## Supporting the project\n\n## Tech stack\n')
    expect(r.removed.map((k) => k.id)).toEqual(['acme'])
  })

  it('fails loudly on a block that is never closed rather than guessing', () => {
    expect(() => stripExpired('<!-- sponsor:acme until=2026-01-01T00:00:00Z -->\nx', 0)).toThrow(/never closed/)
  })

  it('fails loudly on a date it cannot read', () => {
    expect(() => stripExpired('<!-- sponsor:acme until=soon -->\n<!-- /sponsor:acme -->', 0)).toThrow(/unreadable/)
  })
})
