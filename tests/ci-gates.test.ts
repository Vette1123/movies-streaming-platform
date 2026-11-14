import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const ci = readFileSync(
  new URL('../.github/workflows/ci.yml', import.meta.url),
  'utf8'
)

describe('a pull request is checked for everything the repo enforces', () => {
  // Formatting went unchecked until 2026-11-14 and 6 files drifted on main.
  it.each(['pnpm typecheck', 'pnpm lint', 'pnpm prettier:check', 'pnpm test'])(
    'runs %s',
    (command) => {
      expect(ci).toContain(`run: ${command}`)
    }
  )
})
