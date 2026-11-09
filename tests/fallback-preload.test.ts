import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// A tail page preloads the payload its shell fetches, so the request runs with
// the JS download instead of after hydration (mobile LCP 3.6s -> the baked
// pages' ~1s, 2026-11-09). A preload whose URL or mode differs from the fetch is
// worse than none: the browser downloads the payload twice.
const worker = readFileSync('cloudflare/worker.js', 'utf8')
const shell = (name: string) =>
  readFileSync(`app/${name}/page.tsx`, 'utf8').replace(/target!\./g, '')

describe('tail page data preload', () => {
  it('uses the mode a plain fetch() sends', () => {
    expect(worker).toContain(
      '<link rel="preload" as="fetch" href="${escapeHtml(path)}" crossorigin="anonymous">'
    )
  })

  it('puts the preload in the head block both render paths share', () => {
    expect(worker).toMatch(
      /const headBlock = \(meta, ogType, jsonLd\) =>\s*`\$\{preloadLink\(meta\.preload\)\}/
    )
  })

  it.each([
    ['media-fallback', 'preload: `/api/media/${type}/${id}`'],
    ['collection-fallback', 'preload: `/api/collection/${id}`'],
  ])('%s: the Worker preloads exactly what the shell fetches', (name, line) => {
    expect(worker).toContain(line)
    const path = /preload: `([^`]+)`/.exec(line)![1]
    expect(shell(name)).toContain(`\`${path}\``)
  })
})
