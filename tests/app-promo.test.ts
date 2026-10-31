import { readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { FEATURE_AREA } from '@/lib/analytics'
import { COMPANION_APPS, storeHref } from '@/lib/apps'
import { pickPromo, PROMOS } from '@/lib/promo'

const ROUTES = ['/', '/movies', '/tv-shows', '/movies/123', '/search', '/about']

describe('App promo', () => {
  it.each(PROMOS)(
    '$slug links to the store chooser via the apps module',
    ({ slug }) => {
      const app = COMPANION_APPS.find((a) => a.slug === slug)
      expect(app && storeHref(app)).toBe(
        `https://vette1123.github.io/${slug}-privacy/go`
      )
    }
  )

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

  it('picks deterministically per route and shows both apps across the site', () => {
    for (const route of ROUTES) {
      expect(pickPromo(route)).toBe(pickPromo(route))
    }
    const shown = new Set(ROUTES.map((route) => pickPromo(route).slug))
    expect(shown).toEqual(new Set(['masareef', 'rafiq']))
  })

  it('measures both events and is mounted in the footer', () => {
    expect(FEATURE_AREA.promo_shown).toBe('growth')
    expect(FEATURE_AREA.promo_click).toBe('growth')
    const footer = readFileSync('components/layouts/footer.tsx', 'utf8')
    expect(footer).toContain('<AppPromo placement="footer" />')
  })
})
