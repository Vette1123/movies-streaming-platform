import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

import { countFiles } from '../scripts/lib/asset-budget.mjs'

describe('countFiles (cf-deploy route budget guard)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'budget-'))
  mkdirSync(join(dir, 'a', 'b'), { recursive: true })
  writeFileSync(join(dir, 'x.html'), '')
  writeFileSync(join(dir, 'a', 'y.txt'), '')
  writeFileSync(join(dir, 'a', 'b', 'z.txt'), '')

  it('counts nested files from a path', () => {
    expect(countFiles(dir)).toBe(3)
  })

  it('counts nested files from a file: URL, as cf-deploy passes it', () => {
    expect(countFiles(pathToFileURL(dir))).toBe(3)
  })
})
