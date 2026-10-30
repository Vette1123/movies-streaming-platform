import { describe, expect, it } from 'vitest'

import { IMAGE_RESCUE_SCRIPT } from '@/lib/image-rescue'

type Listener = (event: { target: unknown }) => void

const installRescue = () => {
  const added: { type: string; listener: Listener; capture: boolean }[] = []
  const fakeDocument = {
    addEventListener: (type: string, listener: Listener, capture: boolean) =>
      added.push({ type, listener, capture }),
  }
  new Function('document', IMAGE_RESCUE_SCRIPT)(fakeDocument)
  return added[0]
}

const fakeImage = (currentSrc: string, extra: Record<string, unknown> = {}) => {
  const removed: string[] = []
  return {
    tagName: 'IMG',
    currentSrc,
    src: currentSrc,
    removed,
    removeAttribute: (name: string) => removed.push(name),
    ...extra,
  }
}

const WSRV =
  'https://wsrv.nl/?url=https://image.tmdb.org/t/p/original/abc.jpg&w=1200&q=65&output=webp&we&default=1'

describe('IMAGE_RESCUE_SCRIPT', () => {
  it('listens in the capture phase, because error does not bubble', () => {
    const { type, capture } = installRescue()
    expect(type).toBe('error')
    expect(capture).toBe(true)
  })

  it('moves a failed wsrv image to a sized TMDB origin file', () => {
    const image = fakeImage(WSRV)
    installRescue().listener({ target: image })
    expect(image.src).toBe('https://image.tmdb.org/t/p/w1280/abc.jpg')
    expect(image.removed).toEqual(['srcset', 'sizes'])
  })

  it('keeps a poster at the size it already asked for', () => {
    const image = fakeImage(
      'https://wsrv.nl/?url=https://image.tmdb.org/t/p/w500/p.jpg&w=300&q=70'
    )
    installRescue().listener({ target: image })
    expect(image.src).toBe('https://image.tmdb.org/t/p/w500/p.jpg')
  })

  it('leaves an image alone once React owns it', () => {
    const image = fakeImage(WSRV, { __reactProps$abc: {} })
    installRescue().listener({ target: image })
    expect(image.src).toBe(WSRV)
    expect(image.removed).toEqual([])
  })

  it('ignores a failure that is not a wsrv image', () => {
    const origin = 'https://image.tmdb.org/t/p/w500/p.jpg'
    const image = fakeImage(origin)
    const { listener } = installRescue()
    listener({ target: image })
    listener({ target: { tagName: 'SCRIPT' } })
    expect(image.src).toBe(origin)
  })
})
