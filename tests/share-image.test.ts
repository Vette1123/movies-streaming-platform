import { describe, expect, it } from 'vitest'

import { getMediaShareImage } from '@/lib/media'
import { buildDetailsOgImages } from '@/lib/media-page'

// og:image used to be the 2560-wide original (0.2-1 MB, past WhatsApp's
// preview limit) while og:image:width claimed 1280. The size a page states
// must be the size wsrv is asked for.
describe('share image', () => {
  it('asks wsrv for the width it declares', () => {
    const [backdrop] = buildDetailsOgImages('/b.jpg', '/p.jpg', 'Fight Club')
    expect(backdrop.url).toContain('/w1280/b.jpg')
    expect(new URL(backdrop.url).searchParams.get('w')).toBe(
      String(backdrop.width)
    )
    expect(backdrop.width).toBe(1200)
    expect(backdrop.height).toBe(675)
  })

  it('falls back to the w500 poster at its real size, then to nothing', () => {
    expect(getMediaShareImage(null, '/p.jpg')).toMatchObject({
      width: 500,
      height: 750,
    })
    expect(getMediaShareImage(null, '/p.jpg')?.url).toContain('/w500/p.jpg')
    expect(getMediaShareImage(null, null)).toBeNull()
  })
})
