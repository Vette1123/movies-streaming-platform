import { describe, expect, it } from 'vitest'

import { shareUrl } from '@/lib/share-url'

// Shares used to go out untagged, so every visit they brought in counted as
// "direct" in PostHog.
describe('shareUrl', () => {
  it('is the canonical host, tagged with the surface', () => {
    expect(shareUrl('/movies/550', 'title_page')).toBe(
      'https://www.reely.space/movies/550?utm_source=share&utm_medium=title_page'
    )
  })

  it('keeps an invite code and replaces the utm the sharer arrived with', () => {
    const url = new URL(
      shareUrl('/watch-together?room=abc&utm_source=google', 'watch_together')
    )
    expect(url.searchParams.get('room')).toBe('abc')
    expect(url.searchParams.getAll('utm_source')).toEqual(['share'])
    expect(url.searchParams.get('utm_medium')).toBe('watch_together')
  })
})
