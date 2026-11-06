import { describe, expect, it } from 'vitest'

import { OFFERS, type Offer } from '@/config/offers'
import { isLive, offerHref, offerRel, selectOffer } from '@/lib/offers'

const offer = (over: Partial<Offer>): Offer => ({
  id: 'x',
  sponsor: 'X',
  headline: 'h',
  body: 'b',
  cta: 'c',
  href: 'https://x.test/',
  weight: 1,
  placements: ['post-play'],
  ...over,
})

describe('isLive', () => {
  it('runs inclusive of both ends of the booking', () => {
    const o = offer({ from: '2026-12-01', until: '2026-12-31' })
    expect(isLive(o, '2026-11-30')).toBe(false)
    expect(isLive(o, '2026-12-01')).toBe(true)
    expect(isLive(o, '2026-12-31')).toBe(true)
    expect(isLive(o, '2027-01-01')).toBe(false)
  })

  it('treats a missing end as open', () => {
    expect(isLive(offer({}), '2030-01-01')).toBe(true)
  })
})

describe('selectOffer', () => {
  const own = [offer({ id: 'a' }), offer({ id: 'b' })]

  it('gives a live paid booking the whole slot', () => {
    const paid = offer({ id: 'paid', weight: 10, until: '2026-12-31' })
    for (const day of ['2026-12-01', '2026-12-02', '2026-12-03'])
      expect(selectOffer([...own, paid], 'post-play', day)?.id).toBe('paid')
  })

  it('falls back to the own apps once the booking has ended', () => {
    const paid = offer({ id: 'paid', weight: 10, until: '2026-12-31' })
    expect(selectOffer([...own, paid], 'post-play', '2027-01-01')?.id).not.toBe(
      'paid'
    )
  })

  it('rotates tied offers one per day', () => {
    const seen = new Set(
      ['2026-12-01', '2026-12-02'].map(
        (day) => selectOffer(own, 'post-play', day)?.id
      )
    )
    expect(seen).toEqual(new Set(['a', 'b']))
  })

  it('benches weight 0 and returns nothing when nothing is live', () => {
    expect(selectOffer([offer({ weight: 0 })], 'post-play', '2026-12-01')).toBe(
      null
    )
  })
})

describe('offerHref', () => {
  it('tags an affiliate link with the placement, before any fragment', () => {
    expect(
      offerHref(offer({ href: 'https://x.test/p?ref=1#a' }), 'post-play')
    ).toBe('https://x.test/p?ref=1&subid=reely_post-play#a')
  })

  it('leaves our own apps clean', () => {
    const o = offer({ ownApp: true, href: 'https://m.test/?s=reely' })
    expect(offerHref(o, 'post-play')).toBe('https://m.test/?s=reely')
  })
})

describe('offerRel', () => {
  it('marks paid links sponsored and nofollow, own apps neither', () => {
    expect(offerRel(offer({}))).toContain('sponsored')
    expect(offerRel(offer({}))).toContain('nofollow')
    expect(offerRel(offer({ ownApp: true }))).not.toContain('sponsored')
  })
})

describe('the live catalogue', () => {
  const live = OFFERS.filter((o) => o.weight > 0)

  it('never puts a placeholder href live', () => {
    expect(live.filter((o) => !o.href.startsWith('https://'))).toEqual([])
  })

  it('keeps ids unique, since the id is the key and the subid', () => {
    expect(new Set(OFFERS.map((o) => o.id)).size).toBe(OFFERS.length)
  })

  it('gives Masareef the slot until a paid booking outranks it', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(selectOffer(OFFERS, 'post-play', today)?.id).toBe('masareef')
    const paid = offer({ id: 'paid', weight: 10 })
    expect(selectOffer([...OFFERS, paid], 'post-play', today)?.id).toBe('paid')
  })

  it('always has something for the slot today', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(selectOffer(OFFERS, 'post-play', today)).not.toBe(null)
  })

  // The card's layout holds up to these (checked with worst-case copy at 320px
  // and in Arabic); a sponsor's copy longer than this gets edited, not shipped.
  it('keeps every field inside what the card was tested with', () => {
    const LIMITS = { sponsor: 40, headline: 90, body: 220, cta: 28 } as const
    for (const o of OFFERS) {
      for (const [key, max] of Object.entries(LIMITS))
        expect(
          o[key as keyof typeof LIMITS].length,
          `${o.id}.${key}`
        ).toBeLessThanOrEqual(max)
      if (o.coupon) {
        expect(o.coupon.code.length, `${o.id} coupon`).toBeLessThanOrEqual(20)
        expect(o.coupon.saving.length, `${o.id} saving`).toBeLessThanOrEqual(24)
      }
    }
  })

  it('writes every booking window as a real YYYY-MM-DD date', () => {
    for (const o of OFFERS)
      for (const d of [o.from, o.until].filter(Boolean))
        expect(Number.isNaN(Date.parse(`${d}T00:00:00Z`))).toBe(false)
  })
})
