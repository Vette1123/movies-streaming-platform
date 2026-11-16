import type { MetadataRoute } from 'next'

import { isTitleBlocked } from '@/lib/blocked-titles'

export interface SitemapLedger {
  movie?: number[]
  tv?: number[]
  /** Ids TMDB has deleted (scripts/lib/sitemap-ledger.mjs): never listed. */
  gone?: { movie?: number[]; tv?: number[] }
}

const PATHS = { movie: '/movies', tv: '/tv-shows' } as const

/**
 * The titles a past sitemap advertised that this build's lists no longer
 * reach. They stay listed (scripts/lib/sitemap-ledger.mjs says why), at the
 * tail ring's priority, minus anything taken down since or deleted by TMDB.
 */
export function ledgerSitemapEntries(
  ledger: SitemapLedger,
  listed: ReadonlySet<string>,
  baseUrl: string
): MetadataRoute.Sitemap {
  return (['movie', 'tv'] as const).flatMap((type) => {
    const gone = new Set(ledger.gone?.[type] ?? [])
    return (ledger[type] ?? [])
      .filter((id) => !gone.has(id) && !isTitleBlocked(type, id))
      .map((id) => `${baseUrl}${PATHS[type]}/${id}`)
      .filter((url) => !listed.has(url))
      .map((url) => ({
        url,
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      }))
  })
}
