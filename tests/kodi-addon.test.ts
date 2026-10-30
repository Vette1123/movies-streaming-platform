import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

// The add-on is Python, so its suite lives beside it; this is what puts that
// suite inside `pnpm test`.
describe('the Kodi add-on', () => {
  it('passes its own test suite', () => {
    const run = spawnSync(
      'python3',
      ['-m', 'unittest', 'discover', '-s', 'kodi/tests'],
      { encoding: 'utf8' }
    )
    expect(run.status, run.stderr).toBe(0)
  })
})
