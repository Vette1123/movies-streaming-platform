import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// public/_redirects turns Cloudflare's default 307 for a trailing slash into a
// 301, one placeholder rule per path depth. A route deeper than the deepest
// rule would quietly fall back to the 307.
const rules = readFileSync('public/_redirects', 'utf8')
  .split('\n')
  .map((line) => line.trim().split(/\s+/))
  .filter(([from, to]) => from?.startsWith('/:') && to)

const depth = (path: string) => path.split('/').filter(Boolean).length

/** Every page route's URL depth; route groups `(x)` add no segment. */
function routeDepths(dir: string, segments = 0): number[] {
  const found: number[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const adds = /^\(.*\)$/.test(entry.name) ? 0 : 1
      found.push(...routeDepths(join(dir, entry.name), segments + adds))
    } else if (entry.name === 'page.tsx') found.push(segments)
  }
  return found
}

describe('trailing-slash redirects', () => {
  it('are permanent and strip only the slash', () => {
    expect(rules.length).toBeGreaterThan(0)
    for (const [from, to, status] of rules) {
      expect(status).toBe('301')
      expect(from).toBe(`${to}/`)
    }
  })

  it('cover every route depth under app/', () => {
    const covered = new Set(rules.map(([from]) => depth(from)))
    for (const d of routeDepths('app')) if (d > 0) expect(covered).toContain(d)
  })
})
