import { describe, expect, it } from 'vitest'

import {
  organizationJsonLd,
  webApplicationJsonLd,
  websiteJsonLd,
} from '@/lib/structured-data'

// Google crawls a urlTemplate in JSON-LD as a literal URL; the sister site's
// Search Console listed "/?url={search_term_string}" as a page. The site-wide
// graphs ship on every page, so every URL in them must be a real one.
describe('site-wide JSON-LD', () => {
  it('publishes no URL template', () => {
    for (const graph of [
      websiteJsonLd,
      webApplicationJsonLd,
      organizationJsonLd,
    ]) {
      const urls = JSON.stringify(graph).match(/https?:\/\/[^"\s]+/g) ?? []
      expect(urls.length).toBeGreaterThan(0)
      for (const url of urls) expect(url).not.toMatch(/[{}]/)
    }
  })
})
