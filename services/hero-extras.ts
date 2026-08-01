import { cache } from 'react'

import { ItemType } from '@/types/movie-result'
import { Video } from '@/types/video'
import { fetchClient } from '@/lib/fetch-client'
import { HeroExtras, heroExtrasKey, HeroExtrasSeed } from '@/lib/hero-extras'
import { pickLogoPath, TMDBLogo } from '@/lib/logos'
import { pickTrailerKey } from '@/lib/videos'

interface HeroExtrasResponse {
  videos?: { results: Video[] }
  images?: { logos: TMDBLogo[] }
}

// The trailer key + title logo behind a hero slide. Both come from one TMDB
// call via append_to_response, so enriching a slide costs a single request.
// `include_image_language=en,null` pulls English + language-neutral logos.
//
// Shared by the build-time prefetch (buildHeroExtrasSeed, used by the static
// homepage) and the /api/hero-extras fallback route, so the two can't drift in
// how they pick a trailer or a logo. `revalidate` is the caller's choice: false
// for the build-only homepage, the fetchClient default for the route.
export const getHeroExtras = cache(
  async (
    type: ItemType,
    id: number | string,
    revalidate: number | false | undefined = undefined
  ): Promise<HeroExtras> => {
    const url = `${type}/${id}?language=en-US&append_to_response=videos,images&include_image_language=en,null`
    const data = await fetchClient.get<HeroExtrasResponse>(
      url,
      {},
      true,
      revalidate
    )
    return {
      trailerKey: pickTrailerKey(data.videos?.results) ?? null,
      logoPath: pickLogoPath(data.images?.logos) ?? null,
      ready: true,
    }
  }
)

// Prebuild the extras for the slides the static homepage ships, so the hero has
// its logo and trailer the moment it paints and fires ZERO /api/hero-extras
// requests. That route is the only dynamic one left on the site — every call is
// a Worker invocation that can't be edge-cached — so the cheapest version of it
// is the one that never runs.
//
// revalidate:false keeps the homepage genuinely build-only: Next takes the MIN
// of the segment revalidate and every fetch's, so a default-TTL fetch here would
// silently drop the whole route back onto an 8h ISR timer (see the comment on
// app/(landing)/page.tsx). allSettled so one bad title can't fail the hero, and
// the whole thing fail-softs to {} — an empty seed just means the client hook
// falls back to the route, i.e. exactly today's behaviour.
export async function buildHeroExtrasSeed(
  items: { id: number; mediaType: ItemType }[]
): Promise<HeroExtrasSeed> {
  const settled = await Promise.allSettled(
    items.map(async (item) => ({
      key: heroExtrasKey(item.mediaType, item.id),
      value: await getHeroExtras(item.mediaType, item.id, false),
    }))
  )
  const seed: HeroExtrasSeed = {}
  for (const res of settled) {
    if (res.status === 'fulfilled') seed[res.value.key] = res.value.value
  }
  return seed
}
