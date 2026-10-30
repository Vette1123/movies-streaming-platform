import React from 'react'
import { preload } from 'react-dom'

import { MovieDetails } from '@/types/movie-details'
import { Movie } from '@/types/movie-result'
import { SeriesDetails } from '@/types/series-details'
import { wsrvSrcSet } from '@/lib/image-loader'
import { COVER_BACKDROP_SIZES, COVER_POSTER_SIZES } from '@/lib/image-sizes'
import { getMediaTitle } from '@/lib/media'
import { getImageURL } from '@/lib/utils'
import { BlurredImage, HERO_QUALITY } from '@/components/blurred-image'

export type HeroImageMedia = (Movie | MovieDetails) & SeriesDetails

/**
 * Fetch the hero's picture before the hero exists.
 *
 * Exactly what the hero's <img> offers, same srcset and same `sizes`, so the
 * browser picks the same candidate and the <img> finds it in the cache. Without
 * it the LCP image queued behind the stylesheet and the scripts. Two callers:
 * the page itself (rendered into <head>) and MediaLink at the moment of a click,
 * so the picture downloads alongside the page payload instead of after it.
 */
export function preloadHeroImage(
  media?: { backdrop_path?: string | null; poster_path?: string | null } | null
) {
  const path = media?.backdrop_path || media?.poster_path
  if (!path) return
  const src = getImageURL(path)
  const imageSrcSet = wsrvSrcSet(src, HERO_QUALITY)
  if (!imageSrcSet) return
  preload(src, {
    as: 'image',
    imageSrcSet,
    imageSizes: media?.backdrop_path
      ? COVER_BACKDROP_SIZES
      : COVER_POSTER_SIZES,
    fetchPriority: 'high',
  })
}
interface HeroImageProps {
  movie?: HeroImageMedia
  // The one image on the page that is worth fetching eagerly (the LCP). Every
  // other hero waits until it is on screen, so a mounted-but-off-stage slide
  // never races the one being looked at.
  priority?: boolean
}

// The details hero is full-bleed and 100svh tall with `object-cover`, so what
// it paints is the cover width, not the box width — see lib/image-sizes.ts.
// The old `(min-width: 1024px) 1024px, 100vw` here promised a 1024px box to a
// hero as wide as the display: measured on a 2560px window, the browser picked
// the 1080w candidate and stretched it across 2552 CSS px. That 2.4x upscale
// was the "details page looks blurry" report — nothing to do with the CDN, the
// quality setting or the fallback chain. We asked for the wrong width, the same
// class of bug as the wsrv `&we` fix in docs/image-cdn.md.
export const HeroImage = ({ movie, priority = false }: HeroImageProps) => {
  const media = movie
  const alt = (media && getMediaTitle(media)) || 'ALT TEXT'
  if (priority) preloadHeroImage(media)
  // The landscape backdrop fills the hero edge-to-edge on every breakpoint
  // (no side bars). Only when there's no backdrop do we fall back to the
  // portrait poster, cover-cropped so it still fills the frame full width.
  return (
    <>
      {media?.backdrop_path ? (
        // No ken-burns zoom here: the hero box is aspect-video (16:9) to match the
        // backdrop, so object-cover fills it with zero crop. A zoom animation
        // (scale >1) would re-introduce the truncation we just removed.
        <BlurredImage
          src={getImageURL(media?.backdrop_path)}
          alt={alt}
          className="block size-full object-cover object-center"
          fill
          sizes={COVER_BACKDROP_SIZES}
          intro
          // Not `priority`: preloadHeroImage above already emits the preload.
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
        />
      ) : (
        media?.poster_path && (
          <BlurredImage
            // `original`, not the w500 poster: this one is the whole hero when a
            // title has no backdrop, so a 500px source was upscaled across the
            // entire viewport. The loader still clamps the request to what the
            // layout asks for, so the bigger source costs nothing on small
            // screens.
            src={getImageURL(media?.poster_path)}
            alt={alt}
            className="block size-full object-cover object-center"
            fill
            sizes={COVER_POSTER_SIZES}
            intro
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
          />
        )
      )}
    </>
  )
}
