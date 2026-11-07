import { readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { FEATURE_AREA } from '@/lib/analytics'
import { COMPANION_APPS, storeHref } from '@/lib/apps'
import * as promo from '@/lib/promo'
import { PROMOS } from '@/lib/promo'

describe('App promo', () => {
  it.each(PROMOS)(
    '$slug links to the store chooser via the apps module',
    ({ slug }) => {
      const app = COMPANION_APPS.find((a) => a.slug === slug)
      // The app's own short domain with a source tag, never the long
      // github.io chooser (owner's rule, 2026-11-05: the easy link only).
      expect(app && storeHref(app)).toMatch(
        new RegExp(`^https://${slug}\\.mohamedgado\\.com/\\?s=reely`)
      )
    }
  )

  it('never links the long chooser anywhere live', () => {
    for (const file of ['lib/apps.ts', 'config/offers.ts', 'lib/promo.ts'])
      expect(readFileSync(file, 'utf8'), file).not.toMatch(
        /github\.io\/[a-z]+-privacy\/go|\/projects\/[a-z]+\/go/
      )
  })

  it.each(PROMOS)(
    '$slug serves a small square local icon',
    ({ slug, image, size }) => {
      const file = `public${image}`
      expect(image).toBe(`/promo/${slug}.png`)
      const png = readFileSync(file)
      expect(png.readUInt32BE(16)).toBe(size)
      expect(png.readUInt32BE(20)).toBe(size)
      expect(statSync(file).size).toBeLessThan(10_000)
    }
  )

  it('carries the agreed Rafiq copy', () => {
    const rafiq = PROMOS.find(({ slug }) => slug === 'rafiq')
    expect(rafiq?.cta).toBe('Get Rafiq')
    expect(rafiq?.body).toBe(
      "Rafiq is a private Islamic companion with prayer times, Qur'an, adhkar and qibla, from the people behind this site."
    )
  })

  it('shows both apps, Masareef first, when no own-app card sits above', () => {
    expect(PROMOS.map(({ slug }) => slug)).toEqual(['masareef', 'rafiq'])
    expect(promo).not.toHaveProperty('pickPromo')
    expect(promo.promosBeside(null)).toEqual(PROMOS)
    expect(promo.promosBeside({ id: 'paid-sponsor' })).toEqual(PROMOS)
    const strip = readFileSync('components/app-promo.tsx', 'utf8')
    expect(strip).toContain('promosBeside(')
  })

  it('leaves out the app the sponsor card above is already showing', () => {
    const slugs = promo
      .promosBeside({ id: 'masareef', ownApp: true })
      .map(({ slug }) => slug)
    expect(slugs).toEqual(['rafiq'])
  })

  it('measures both events and is mounted in the footer', () => {
    expect(FEATURE_AREA.promo_shown).toBe('growth')
    expect(FEATURE_AREA.promo_click).toBe('growth')
    const footer = readFileSync('components/layouts/footer.tsx', 'utf8')
    expect(footer).toContain('<AppPromo placement="footer" />')
  })
})
