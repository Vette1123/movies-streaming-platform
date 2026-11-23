import {
  LEDGER_SHARDS,
  SITEMAP_SECTIONS,
  sitemapFiles,
  sitemapSectionUrl,
  type SitemapSection,
} from '@/lib/sitemap-sections'
import {
  renderSitemapIndex,
  renderUrlset,
  xmlResponse,
} from '@/lib/sitemap-xml'

// The GET handlers behind /sitemap.xml and /sitemaps/<file>.xml. Each route
// file is `force-static`, so these run once at build and the export writes
// plain .xml assets; Cloudflare serves them before the Worker ever runs.

// The index's lastmod is the build: the sections are rebuilt on every deploy.
const BUILT_AT = new Date().toISOString()

export const sitemapIndexResponse = () =>
  xmlResponse(
    renderSitemapIndex(sitemapFiles().map(sitemapSectionUrl), BUILT_AT)
  )

export const sitemapSectionResponse = async (section: SitemapSection) =>
  xmlResponse(renderUrlset(await SITEMAP_SECTIONS[section]()))

export const sitemapShardResponse = async (shard: string) => {
  const entries = LEDGER_SHARDS[shard]
  if (!entries) return new Response('Not found', { status: 404 })
  return xmlResponse(renderUrlset(await entries()))
}
