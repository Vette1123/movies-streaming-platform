import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { IMAGE_RESCUE_SCRIPT } from '@/lib/image-rescue'

type Listener = (event: { target: unknown }) => void

const fakeImage = (currentSrc: string, extra: Record<string, unknown> = {}) => {
  const removed: string[] = []
  return {
    tagName: 'IMG',
    currentSrc,
    src: currentSrc,
    complete: true,
    loading: 'eager',
    removed,
    removeAttribute: (name: string) => removed.push(name),
    ...extra,
  }
}

const probes: { src?: string; onload?: () => void }[] = []

const installRescue = (images: unknown[] = []) => {
  const added: { type: string; listener: Listener; capture: boolean }[] = []
  const fakeDocument = {
    images,
    addEventListener: (type: string, listener: Listener, capture: boolean) =>
      added.push({ type, listener, capture }),
  }
  class FakeImage {
    constructor() {
      probes.push(this)
    }
  }
  new Function('document', 'Image', IMAGE_RESCUE_SCRIPT)(
    fakeDocument,
    FakeImage
  )
  return added[0]
}

const WSRV =
  'https://wsrv.nl/?url=https://image.tmdb.org/t/p/original/abc.jpg&w=1200&q=65&output=webp&we&default=1'

beforeEach(() => {
  vi.useFakeTimers()
  probes.length = 0
})
afterEach(() => vi.useRealTimers())

describe('IMAGE_RESCUE_SCRIPT, refused', () => {
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

  it('drops a <picture> source, which would otherwise outrank the new src', () => {
    const removedSources: string[] = []
    const sources = ['portrait'].map((name) => ({
      remove: () => removedSources.push(name),
    }))
    const image = fakeImage(WSRV, {
      parentNode: { tagName: 'PICTURE', querySelectorAll: () => sources },
    })
    installRescue().listener({ target: image })
    expect(removedSources).toEqual(['portrait'])
    expect(image.src).toBe('https://image.tmdb.org/t/p/w1280/abc.jpg')
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

describe('IMAGE_RESCUE_SCRIPT, hung', () => {
  const pendingPoster =
    'https://wsrv.nl/?url=https://image.tmdb.org/t/p/w500/p.jpg&w=320&q=70'

  it('spends no request when nothing is waiting', () => {
    installRescue([fakeImage(WSRV)])
    vi.advanceTimersByTime(12_000)
    expect(probes).toHaveLength(0)
  })

  it('probes with a 1px file once an eager image has waited 8s', () => {
    installRescue([fakeImage(WSRV, { complete: false })])
    vi.advanceTimersByTime(7_999)
    expect(probes).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(probes).toHaveLength(1)
    expect(probes[0].src).toMatch(/\/original\/abc\.jpg&w=1$/)
  })

  it('moves everything still waiting when the probe gets no answer', () => {
    const hero = fakeImage(WSRV, { complete: false })
    const poster = fakeImage(pendingPoster, {
      complete: false,
      loading: 'lazy',
    })
    installRescue([hero, poster])
    vi.advanceTimersByTime(12_000)
    expect(hero.src).toBe('https://image.tmdb.org/t/p/w1280/abc.jpg')
    expect(poster.src).toBe('https://image.tmdb.org/t/p/w500/p.jpg')
  })

  it('leaves a slow link alone: the host answered', () => {
    const hero = fakeImage(WSRV, { complete: false })
    installRescue([hero])
    vi.advanceTimersByTime(9_000)
    probes[0].onload?.()
    vi.advanceTimersByTime(3_000)
    expect(hero.src).toBe(WSRV)
  })

  it('does not wake for a lazy image the browser has not started', () => {
    installRescue([
      fakeImage(pendingPoster, { complete: false, loading: 'lazy' }),
    ])
    vi.advanceTimersByTime(12_000)
    expect(probes).toHaveLength(0)
  })
})
