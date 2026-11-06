import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { shellMetadata } from '@/lib/shell-metadata'

// The root layout's canonical is the homepage. A page that does not drop it
// inherits it, and the 404 page is served under EVERY unknown URL: Bing
// reported "a large number of pages pointing to the same canonical URL"
// (2026-11-06). A noindex page needs no canonical at all.
describe('404 page canonical', () => {
  it('drops the inherited homepage canonical', () => {
    expect(shellMetadata.alternates).toBeNull()
    const page = readFileSync('app/not-found.tsx', 'utf8')
    expect(page).toMatch(/\.\.\.shellMetadata/)
  })
})
