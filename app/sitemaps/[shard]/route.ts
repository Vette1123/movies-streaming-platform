import { sitemapShardResponse } from '@/lib/sitemap-route'
import { LEDGER_SHARDS } from '@/lib/sitemap-sections'

// /sitemaps/<type>-ledger-<n>.xml, one per shard of data/sitemap-ledger.json.
// Built once each at export; see LEDGER_SHARDS in lib/sitemap-sections.ts.
export const dynamic = 'force-static'
export const dynamicParams = false

export const generateStaticParams = () =>
  Object.keys(LEDGER_SHARDS).map((name) => ({ shard: `${name}.xml` }))

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ shard: string }> }
) => sitemapShardResponse((await params).shard.replace(/\.xml$/, ''))
