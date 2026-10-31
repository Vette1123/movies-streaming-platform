import { beforeEach, describe, expect, it, vi } from 'vitest'

import { heroCopyEnters } from '@/lib/hero-title'
import {
  forgetShownImages,
  imageShown,
  instantImageProps,
  MAX_SHOWN_IMAGES,
  rememberImage,
} from '@/lib/image-memory'
import { RAIL_ENTRANCE_COUNT, staticRailCard } from '@/lib/rail-scroll'

const picture = (currentSrc: string) =>
  ({ currentSrc, src: currentSrc }) as HTMLImageElement

describe('pictures already shown', () => {
  const held: { src: string }[] = []

  beforeEach(() => {
    forgetShownImages()
    held.length = 0
    vi.stubGlobal(
      'Image',
      class {
        set src(value: string) {
          held.push({ src: value })
        }
      }
    )
  })

  it('knows a picture once it has been shown', () => {
    expect(imageShown('a')).toBe(false)
    rememberImage('a', picture('a-480'))
    expect(imageShown('a')).toBe(true)
  })

  it('holds the variant the browser picked, not the prop', () => {
    rememberImage('a', picture('a-480'))
    expect(held).toEqual([{ src: 'a-480' }])
  })

  it('holds a picture once', () => {
    rememberImage('a', picture('a-480'))
    rememberImage('a', picture('a-480'))
    expect(held).toHaveLength(1)
  })

  it('drops the picture left unused longest past the cap', () => {
    for (let i = 0; i < MAX_SHOWN_IMAGES; i++) {
      rememberImage(`p${i}`, picture(`p${i}`))
    }
    rememberImage('p0', picture('p0'))
    rememberImage('new', picture('new'))
    expect(imageShown('p0')).toBe(true)
    expect(imageShown('p1')).toBe(false)
    expect(imageShown('new')).toBe(true)
  })

  it('ignores a statically imported image', () => {
    expect(imageShown({ src: 'a', height: 1, width: 1 })).toBe(false)
  })

  it('paints a shown picture with its frame, whatever the caller asked', () => {
    expect(instantImageProps(true)).toEqual({
      loading: 'eager',
      decoding: 'sync',
    })
    expect(instantImageProps(false)).toEqual({})
  })
})

describe('a page rebuilt by Back', () => {
  it('keeps the static rail entrance on a first visit only', () => {
    expect(staticRailCard(0, false).entrance).toBe(true)
    expect(staticRailCard(0, true).entrance).toBe(false)
  })

  it('has every poster, so it never shows an empty box', () => {
    expect(staticRailCard(RAIL_ENTRANCE_COUNT, false).poster).toBe(false)
    expect(staticRailCard(RAIL_ENTRANCE_COUNT, true).poster).toBe(true)
  })

  it('does not replay the hero copy', () => {
    expect(heroCopyEnters({ settled: true, rebuilt: false })).toBe(true)
    expect(heroCopyEnters({ settled: true, rebuilt: true })).toBe(false)
    expect(heroCopyEnters({ settled: false, rebuilt: false })).toBe(false)
  })
})
