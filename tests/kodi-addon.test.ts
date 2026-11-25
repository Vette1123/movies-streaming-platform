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
    // The suite itself takes ~0.6 s; spawning python3 while the full run starts
    // ~158 workers took 12.6 s on Windows (2026-11-25), past the 5 s default.
  }, 30_000)
})
