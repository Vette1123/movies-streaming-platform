import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

import { PRO_EMAIL, proMailto } from '@/config/support'

// The Buy Me a Coffee account was suspended on 2026-11-06. Every link to it now
// sends money (or a supporter) to a dead page, so nothing live may name it.
// lessons/ and migrations/ are history and stay as written.
const BANNED =
  'buymeacoffee|buy me a coffee|/api/billing/bmc|BMC_WEBHOOK|bmc-widget|#bmc-'
const HISTORY = [':!lessons', ':!migrations', ':!docs/superpowers']
const SELF = 'tests/pro-by-email.test.ts'

/** Tracked text files outside history that match `pattern` (case-insensitive). */
function trackedHits(pattern: string): string[] {
  // git grep, not a readFileSync walk: -I skips binaries natively. The walk read
  // 31 MB of tracked .mp4/.wav as text and timed out (9.8 s) on 2026-11-25.
  const run = spawnSync(
    'git',
    [
      'grep',
      '-l',
      '-I',
      '-i',
      '-E',
      pattern,
      '--',
      '.',
      ...HISTORY,
      `:!${SELF}`,
    ],
    { encoding: 'utf8' }
  )
  // Exit 1 is "no match"; above 1 is a real error, which must not pass as clean.
  expect(run.status, run.stderr).not.toBeGreaterThan(1)
  return run.stdout.split('\n').filter(Boolean)
}

describe('Buy Me a Coffee is gone', () => {
  it('no tracked file outside history names it', () => {
    expect(trackedHits(BANNED)).toEqual([])
  })

  it('the scan finds a name that is there', () => {
    // Guards the guard: a broken pathspec or flag would make the test above
    // pass vacuously.
    expect(trackedHits('Reely Pro')).not.toEqual([])
  })
})

describe('proMailto', () => {
  it('addresses the Pro inbox with an encoded subject and body', () => {
    const href = proMailto('Yearly', 'a+b@example.com')
    expect(href.startsWith(`mailto:${PRO_EMAIL}?subject=`)).toBe(true)
    const params = new URLSearchParams(href.split('?')[1])
    expect(params.get('subject')).toBe('Reely Pro — Yearly')
    expect(params.get('body')).toContain('a+b@example.com')
  })

  it('asks for the sign-in address when it is not known', () => {
    const params = new URLSearchParams(
      proMailto('Lifetime', null).split('?')[1]
    )
    expect(params.get('body')).toContain('The email I sign in to Reely with:')
  })
})
