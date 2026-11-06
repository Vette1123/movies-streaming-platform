import type { MetadataRoute } from 'next'

import { isTitleBlocked } from '@/lib/blocked-titles'

export interface SitemapLedger {
  movie?: number[]
  tv?: number[]
}

const PATHS = { movie: '/movies', tv: '/tv-shows' } as const

/**
 * The titles a past sitemap advertised that this build's lists no longer
 * reach. They stay listed (scripts/lib/sitemap-ledger.mjs says why), at the
 * tail ring's priority, minus anything taken down since.
 */
export function ledgerSitemapEntries(
  ledger: SitemapLedger,
  listed: ReadonlySet<string>,
  baseUrl: string
): MetadataRoute.Sitemap {
  return (['movie', 'tv'] as const).flatMap((type) =>
    (ledger[type] ?? [])
      .filter((id) => !isTitleBlocked(type, id))
      .map((id) => `${baseUrl}${PATHS[type]}/${id}`)
      .filter((url) => !listed.has(url))
      .map((url) => ({
        url,
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      }))
  )
}
