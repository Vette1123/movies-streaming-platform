import React from 'react'
import { getPopularMovies } from '@/services/movies'

import { mediaListMetadata, MOVIES_LIST_CONFIG } from '@/lib/media-page'
import { QUERY_KEYS } from '@/lib/queryKeys'
import { MediaListPage } from '@/components/media/media-list-page'

// Fully static (see app/(landing)/page.tsx): built once per deploy, served from
// assets, never rendered on the Worker — so no free-plan subrequest/CPU caps.
// Filters + pagination are client-side (MediaContent), so nothing here is dynamic.
// getPopularMovies fetches with revalidate:false (services/movies.ts), which is
// what makes the route build-only — revalidate=false alone would be floored to 8h
// by the fetch's own revalidate.
export const revalidate = false

export const metadata = mediaListMetadata(MOVIES_LIST_CONFIG)

async function Movies() {
  const movies = await getPopularMovies()
  return (
    <MediaListPage
      media={movies}
      queryKey={QUERY_KEYS.MOVIES_KEY}
      config={MOVIES_LIST_CONFIG}
    />
  )
}

export default Movies
