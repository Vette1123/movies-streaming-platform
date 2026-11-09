import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The Worker prepends its crawler block to <body> on every tail page. The
// shell's own first body child is Next's `<div hidden>`, and React 19 claims a
// body node for hydration when its tag matches the one it expects: a <div>
// block was taken for Next's div, threw React #418 on every tail page and was
// deleted by the client re-render, so Google rendered only the skeleton and
// filed the tail as duplicates (2026-11-09). See cloudflare/worker.js seoBlock.
const worker = readFileSync('cloudflare/worker.js', 'utf8')
const template = /const seoBlock = \(meta\) =>\s*`([\s\S]*?)`\n/.exec(
  worker
)?.[1]

describe('the Worker crawler block', () => {
  it('is found in the worker source', () => {
    expect(template).toBeTruthy()
  })

  it('is not a <div>, so React never hydrates it as the shell first child', () => {
    const open = /^<([a-z]+)\b/.exec(template ?? '')?.[1]
    expect(open).toBeTruthy()
    expect(open).not.toBe('div')
    expect(template?.endsWith(`</${open}>`)).toBe(true)
  })

  it('stays clipped, not hidden', () => {
    const open = /^<[^>]+>/.exec(template ?? '')?.[0] ?? ''
    expect(open).toContain('data-fallback-seo')
    expect(open).not.toMatch(/\shidden(\s|=|>)/)
  })
})
