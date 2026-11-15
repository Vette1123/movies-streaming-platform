import { sitemapIndexResponse } from '@/lib/sitemap-route'

// Required by `output: 'export'`: built once, written to out/sitemap.xml.
// A <sitemapindex> over /sitemaps/*.xml; see lib/sitemap-sections.ts.
export const dynamic = 'force-static'

export const GET = () => sitemapIndexResponse()
