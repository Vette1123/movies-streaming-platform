import { NextRequest, NextResponse } from 'next/server'

import { Video } from '@/types/video'
import { fetchClient } from '@/lib/fetch-client'
import { pickLogoPath, TMDBLogo } from '@/lib/logos'
import { pickTrailerKey } from '@/lib/videos'

interface HeroExtrasResponse {
  videos?: { results: Video[] }
  images?: { logos: TMDBLogo[] }
}

// Per-slide enrichment for the hero carousel: the best YouTube trailer key and
// the official title-logo path for one title. Fetched lazily on the client only
// for slides that actually mount (the active slide + its neighbours), so we
// never enrich all ~40 trending items up front. Rides on a single TMDB call via
// append_to_response, and fetchClient's 8h ISR cache makes repeat views free.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const id = searchParams.get('id')
  const type = searchParams.get('type') === 'tv' ? 'tv' : 'movie'

  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  try {
    // include_image_language=en,null pulls English + language-neutral logos.
    const data = await fetchClient.get<HeroExtrasResponse>(
      `${type}/${id}?language=en-US&append_to_response=videos,images&include_image_language=en,null`,
      {},
      true
    )

    const body = {
      trailerKey: pickTrailerKey(data.videos?.results) ?? null,
      logoPath: pickLogoPath(data.images?.logos) ?? null,
    }

    return NextResponse.json(body, {
      // Let the CDN hold the tiny JSON at the edge too; the underlying TMDB
      // fetch is already ISR-cached for the same window.
      headers: { 'Cache-Control': 'public, s-maxage=28800, max-age=3600' },
    })
  } catch {
    // Enrichment is non-critical — the slide still works without a trailer or
    // logo, so degrade quietly rather than surfacing an error.
    return NextResponse.json({ trailerKey: null, logoPath: null })
  }
}
