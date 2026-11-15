import { sitemapSectionResponse } from '@/lib/sitemap-route'

export const dynamic = 'force-static'

export const GET = () => sitemapSectionResponse('core')
