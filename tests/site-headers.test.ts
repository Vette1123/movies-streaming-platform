import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { siteHeaders } from '../scripts/lib/site-headers.mjs'

const root = path.join(__dirname, '..')

describe('siteHeaders', () => {
  it('carries the CI pass through the WAF when the secret is set', () => {
    const headers = siteHeaders({ CI_WAF_BYPASS: 'x'.repeat(32) })
    expect(headers['x-reely-ci']).toBe('x'.repeat(32))
    expect(headers['User-Agent']).toMatch(/Chrome/)
  })

  it('sends a browser UA alone without the secret', () => {
    expect(siteHeaders({})).toEqual({
      'User-Agent': expect.stringMatching(/Chrome/),
    })
  })

  // seo:verify sent a bare browser UA and read the managed challenge on every
  // tail page as 10 SEO failures (2026-11-24).
  it.each([
    'scripts/verify-seo.mjs',
    'scripts/lib/indexnow.mjs',
    'scripts/lib/submit-sitemaps.mjs',
  ])('%s reads our pages through siteHeaders', (file) => {
    const src = readFileSync(path.join(root, file), 'utf8')
    expect(src).toMatch(/siteHeaders\(\)/)
    expect(src).not.toMatch(/x-reely-ci/)
  })
})
