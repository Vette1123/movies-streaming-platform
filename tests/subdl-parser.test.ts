import { describe, expect, it } from 'vitest'

import { parseSubdlEntries } from '@/lib/stream/subdl'

// Fixture shaped like the real page (subdl.com title page, measured
// 2026-08-22): each entry root carries data-language; season/episode scoping
// is optional data-* attrs; the dl link sits inside the entry.
const FIXTURE = `
<div data-language="english" class="entry">
  <div><h4>Fight.Club.1999.1080p.BluRay.x264</h4></div>
  <a href="https://dl.subdl.com/subtitle/111-aaa.zip">download</a>
</div>
<div data-language="arabic" class="entry">
  <h4>Fight.Club.1999.1080p.bluray.mora</h4>
  <a href="https://dl.subdl.com/subtitle/222-bbb.zip">download</a>
</div>
<div data-language="arabic" data-season-from="1" data-season-to="1" data-full-season="1" class="entry">
  <h4>Some.Series.S01.COMPLETE</h4>
  <a href="https://dl.subdl.com/subtitle/333-ccc.zip">download</a>
</div>
`

describe('parseSubdlEntries', () => {
  it('pairs every link with its nearest preceding language marker', () => {
    const entries = parseSubdlEntries(FIXTURE)
    expect(entries).toHaveLength(3)
    expect(entries[0]).toMatchObject({
      languageSlug: 'english',
      url: 'https://dl.subdl.com/subtitle/111-aaa.zip',
    })
    expect(entries[1].languageSlug).toBe('arabic')
    expect(entries[2].languageSlug).toBe('arabic')
  })

  it('keeps season/episode/full-season scoping when present', () => {
    const [, , tv] = parseSubdlEntries(FIXTURE)
    expect(tv.seasonFrom).toBe(1)
    expect(tv.fullSeason).toBe(true)
    // Movie entries carry no scoping at all.
    const [movie] = parseSubdlEntries(FIXTURE)
    expect(movie.seasonFrom).toBeUndefined()
    expect(movie.fullSeason).toBeUndefined()
  })

  it('ignores links that appear before any language marker', () => {
    const html =
      '<a href="https://dl.subdl.com/subtitle/000-orphan.zip"></a>' +
      '<div data-language="arabic"><a href="https://dl.subdl.com/subtitle/111-ok.zip"></a></div>'
    const entries = parseSubdlEntries(html)
    expect(entries).toHaveLength(1)
    expect(entries[0].url).toContain('111-ok')
  })
})
