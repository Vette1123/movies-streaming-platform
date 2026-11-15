import {
  SITEMAP_SECTIONS,
  sitemapSectionUrl,
  type SitemapSection,
} from '@/lib/sitemap-sections'
import {
  renderSitemapIndex,
  renderUrlset,
  xmlResponse,
} from '@/lib/sitemap-xml'

// The GET handlers behind /sitemap.xml and /sitemaps/<section>.xml. Each route
// file is `force-static`, so these run once at build and the export writes
// plain .xml assets; Cloudflare serves them before the Worker ever runs.

// The index's lastmod is the build: the sections are rebuilt on every deploy.
const BUILT_AT = new Date().toISOString()

export const sitemapIndexResponse = () =>
  xmlResponse(
    renderSitemapIndex(
      (Object.keys(SITEMAP_SECTIONS) as SitemapSection[]).map(
        sitemapSectionUrl
      ),
      BUILT_AT
    )
  )

export const sitemapSectionResponse = async (section: SitemapSection) =>
  xmlResponse(renderUrlset(await SITEMAP_SECTIONS[section]()))
