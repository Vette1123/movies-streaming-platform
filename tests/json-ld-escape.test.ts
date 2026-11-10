import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { aggregateRating, jsonLdText } from '@/lib/json-ld'

// List names, profile names and bios are user-written and land inside
// <script type="application/ld+json"> on the Worker-rendered /l/ and /u/
// pages. Plain JSON.stringify leaves `</script>` intact, which closes the
// script and runs whatever follows on the reely.space origin.
describe('jsonLdText', () => {
  const hostile = {
    name: '</script><img src=x onerror=alert(1)>',
    description: 'line\u2028sep\u2029end <!-- -->',
  }

  it('cannot close the script element it sits in', () => {
    const text = jsonLdText(hostile)
    expect(text).not.toMatch(/<\//)
    expect(text).not.toContain('<!--')
    expect(text).not.toMatch(/[\u2028\u2029]/)
  })

  it('still parses back to the same data', () => {
    expect(JSON.parse(jsonLdText(hostile))).toEqual(hostile)
  })

  it('rates on the same 1-10 numeric scale on every page', () => {
    expect(aggregateRating(8.4321, 120)).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 8.4,
      bestRating: 10,
      worstRating: 1,
      ratingCount: 120,
    })
    expect(aggregateRating(7, 0)).toBeUndefined()
    expect(aggregateRating(null, 5)).toBeUndefined()
  })

  it('is the only way JSON-LD reaches HTML', () => {
    for (const file of ['cloudflare/worker.js', 'lib/structured-data.tsx']) {
      const src = readFileSync(file, 'utf8')
      expect(src, file).toContain('jsonLdText(')
      expect(src, file).not.toMatch(/ld\+json[^\n]*JSON\.stringify/)
      expect(src, file).not.toMatch(/__html: JSON\.stringify/)
    }
  })
})
