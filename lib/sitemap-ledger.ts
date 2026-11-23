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

/**
 * One sitemap file may hold 50,000 URLs and Google rejects the whole file over
 * that. A shard of 20,000 also keeps each file a few MB, quick to fetch.
 */
export const LEDGER_SHARD_SIZE = 20_000

/**
 * `ids` sorted ascending and cut into consecutive shards of `size`. Cut by
 * position in the sorted list, so a shard's file stays nearly the same file
 * between deploys.
 */
export function ledgerShards(
  ids: readonly number[],
  size = LEDGER_SHARD_SIZE
): number[][] {
  const sorted = [...ids].sort((a, b) => a - b)
  return Array.from({ length: Math.ceil(sorted.length / size) }, (_, i) =>
    sorted.slice(i * size, (i + 1) * size)
  )
}
