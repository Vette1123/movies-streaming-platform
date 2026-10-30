import { readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { FEATURE_AREA } from '@/lib/analytics'
import { COMPANION_APPS, storeHref } from '@/lib/apps'

const ICON = 'public/promo/masareef.png'

describe('Masareef promo', () => {
  it('links to the store chooser through the apps module', () => {
    const app = COMPANION_APPS.find(({ slug }) => slug === 'masareef')
    expect(app && storeHref(app)).toBe(
      'https://vette1123.github.io/masareef-privacy/go'
    )
  })

  it('serves a small 80x80 local icon', () => {
    const png = readFileSync(ICON)
    expect(png.readUInt32BE(16)).toBe(80)
    expect(png.readUInt32BE(20)).toBe(80)
    expect(statSync(ICON).size).toBeLessThan(10_000)
  })

  it('measures both events and is mounted in the footer', () => {
    expect(FEATURE_AREA.promo_shown).toBe('growth')
    expect(FEATURE_AREA.promo_click).toBe('growth')
    const footer = readFileSync('components/layouts/footer.tsx', 'utf8')
    expect(footer).toContain('<MasareefPromo placement="footer" />')
  })
})
