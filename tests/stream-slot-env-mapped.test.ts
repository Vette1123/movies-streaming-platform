import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Turbopack inlines only the env vars that exist at build time. A slot var
// read in config/sources.ts but not forwarded by the deploy workflow is
// silently undefined in prod: Server 4 vanished that way on 2026-08-23, and
// slots 1-3 gained path templates on 2026-11-22.
describe('every stream slot var reaches the production build', () => {
  const sources = readFileSync('config/sources.ts', 'utf8')
  const workflow = readFileSync('.github/workflows/deploy.yml', 'utf8')
  const read = [
    ...new Set(
      [...sources.matchAll(/process\.env\.(NEXT_PUBLIC_STREAM\w*)/g)].map(
        (m) => m[1]
      )
    ),
  ]

  it('reads slot vars at all', () => {
    expect(read.length).toBeGreaterThan(10)
  })

  it.each(read)('%s is mapped in deploy.yml', (name) => {
    expect(workflow).toContain(`${name}: \${{ secrets.${name} }}`)
  })
})
