import React from 'react'
import { getPopularSeries } from '@/services/series'

import { mediaListMetadata, TV_LIST_CONFIG } from '@/lib/media-page'
import { QUERY_KEYS } from '@/lib/queryKeys'
import { MediaListPage } from '@/components/media/media-list-page'

// Fully static (see app/(landing)/page.tsx): built once per deploy, served from
// assets, never rendered on the Worker — so no free-plan subrequest/CPU caps.
// Filters + pagination are client-side (MediaContent), so nothing here is dynamic.
// getPopularSeries fetches with revalidate:false (services/series.ts), which is
// what makes the route build-only — revalidate=false alone would be floored to 8h
// by the fetch's own revalidate.
export const revalidate = false

export const metadata = mediaListMetadata(TV_LIST_CONFIG)

async function TvShows() {
  const series = await getPopularSeries()
  return (
    <MediaListPage
      media={series}
      getPopularMediaAction={getPopularSeries}
      queryKey={QUERY_KEYS.SERIES_KEY}
      config={TV_LIST_CONFIG}
    />
  )
}

export default TvShows
