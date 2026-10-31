import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  ALL_SUPPORT_FEATURE_GROUPS,
  FEATURE_PROMISE,
  SUPPORT_FEATURE_COUNT,
  TV_FEATURE,
} from '@/config/support-features'

const features = ALL_SUPPORT_FEATURE_GROUPS.flatMap((group) => group.features)

describe('the supporter feature list', () => {
  it('lists each feature once and counts them all', () => {
    const titles = features.map((feature) => feature.title)
    expect(new Set(titles).size).toBe(titles.length)
    expect(SUPPORT_FEATURE_COUNT).toBe(titles.length)
  })

  it('shows supporters the TV feature, with a link to its setup guide', () => {
    expect(features).toContain(TV_FEATURE)
    expect(TV_FEATURE.link?.href).toBe('/kodi')
  })

  it('links only to pages that exist', () => {
    const hrefs = features.flatMap((feature) =>
      feature.link ? [feature.link.href] : []
    )
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
      expect(existsSync(`app${href}/page.tsx`), href).toBe(true)
    }
  })

  it('makes the feature promise on the page and on the supporter panel', () => {
    expect(FEATURE_PROMISE.title).toMatch(/any feature/i)
    for (const file of [
      'app/support/page.tsx',
      'components/support/plan-view.tsx',
    ]) {
      expect(readFileSync(file, 'utf8')).toContain('<FeaturePromise />')
    }
  })
})

describe('reaching the Kodi guide', () => {
  it('is linked from the footer, the account panel and /link', () => {
    for (const file of [
      'components/layouts/footer.tsx',
      'components/account/account-panel.tsx',
      'components/account/link-device.tsx',
    ]) {
      expect(readFileSync(file, 'utf8'), file).toMatch(/['"]\/kodi['"]/)
    }
  })
})
