import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const worker = readFileSync('cloudflare/worker.js', 'utf8')
const headers = readFileSync('public/_headers', 'utf8')

describe('fallback HTML caching', () => {
  it('never lets a browser keep a document that names hashed chunks', () => {
    const htmlResponses = worker.match(
      /'Content-Type': 'text\/html; charset=utf-8',\s+'Cache-Control': \w+/g
    )
    expect(htmlResponses?.length).toBeGreaterThan(0)
    for (const response of htmlResponses ?? []) {
      expect(response).toContain('HTML_CACHE_CONTROL')
    }
  })

  it('matches the header prerendered detail pages get', () => {
    const value = worker.match(/const HTML_CACHE_CONTROL =\s+'([^']+)'/)?.[1]
    expect(value).toContain('max-age=0')
    expect(headers).toContain(`/movies/*\n  Cache-Control: ${value}`)
  })
})
