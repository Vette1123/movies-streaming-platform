import React from 'react'
import { preload } from 'react-dom'

import { MovieDetails } from '@/types/movie-details'
import { Movie } from '@/types/movie-result'
import { SeriesDetails } from '@/types/series-details'
import { avifSrcSet } from '@/lib/image-loader'
import { COVER_BACKDROP_SIZES, COVER_POSTER_SIZES } from '@/lib/image-sizes'
import { getMediaTitle } from '@/lib/media'
import { getImageURL } from '@/lib/utils'
import { BlurredImage, HERO_QUALITY } from '@/components/blurred-image'
import { usePointerPosition } from '@/hooks/use-pointer-position'
import { useReducedMotion } from 'framer-motion'

export type HeroImageMedia = (Movie | MovieDetails) & SeriesDetails

/**
 * Fetch the hero's picture before the hero exists.
 *
 * Exactly what the hero's AVIF <source> offers — same srcset, same `sizes` —
 * so the browser picks the same candidate and the <img> finds it in the cache.
 * `type` keeps it honest: a browser that cannot decode AVIF skips the preload
 * along with the <source>, and fetches nothing twice.
 *
 * This is the preload the comment below gave up, without what it gave up for.
 * next/image's `priority` preload names the WebP srcset, so it bought a
 * ~130ms head start at the price of the AVIF bytes; this names the AVIF one.
 * Two callers: the page itself (rendered into <head>, ahead of the stylesheet
 * and scripts the preload scanner would otherwise reach first) and MediaLink at
 * the moment of a click, so the picture downloads alongside the page payload
 * instead of after it.
 */
export function preloadHeroImage(
  media?: { backdrop_path?: string | null; poster_path?: string | null } | null
) {
  const path = media?.backdrop_path || media?.poster_path
  if (!path) return
  const src = getImageURL(path)
  const imageSrcSet = avifSrcSet(src, HERO_QUALITY)
  if (!imageSrcSet) return
  preload(src, {
    as: 'image',
    type: 'image/avif',
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
  const reduce = useReducedMotion()
  // Pointer as a 0..1 point over the viewport, used for parallax and the
  // spotlight. On reduced motion or touch there is no pointer to follow, so
  // both effects stay at rest.
  const [pointerX, pointerY] = usePointerPosition()

  // Parallax moves the backdrop opposite the pointer, so the artwork feels
  // like it sits behind a pane of glass rather than flat on the page. Kept
  // tiny (±8px) so it reads as depth, not motion sickness — and off entirely
  // under reduced motion, where a static image is the courtesy.
  const parallax = reduce
    ? 'none'
    : `translate3d(${-pointerX * 16}px, ${-pointerY * 12}px, 0)`

  return (
    <div className="relative size-full overflow-hidden">
      {/* Landscape backdrop fills the hero edge-to-edge on every breakpoint
          (no side bars). Only when there's no backdrop do we fall back to the
          portrait poster, cover-cropped so it still fills the frame full width. */}
      {media?.backdrop_path ? (
        <div
          className="absolute inset-0 z-0"
          style={{
            transform: parallax,
            viewTransitionName: media.id
              ? `poster-${media.id}`
              : undefined,
          }}
        >
          <BlurredImage
            src={getImageURL(media?.backdrop_path)}
            alt={alt}
            className="block size-full object-cover object-center motion-reduce:animate-none"
            fill
            sizes={COVER_BACKDROP_SIZES}
            intro
            // `loading="eager"` + `fetchPriority="high"` rather than `priority`,
            // which is the same thing MINUS Next's `<link rel=preload
            // imagesrcset>`. Losing the preload is what BUYS the AVIF: the
            // preload names the WebP srcset, so an image that carries one can't
            // also offer an AVIF <source> without risking the LCP image being
            // downloaded twice (see components/blurred-image.tsx).
            //
            // Measured on this page, 1.6 Mbit / 4x CPU, cold cache, dpr 2, 4 runs
            // each — the hero is 2560 px wide either way:
            //
            //   priority + WebP   110 KB   fetch starts ~320ms, done ~4.8s
            //   eager    + AVIF    65 KB   fetch starts ~450ms, done ~3.3s
            //
            // The preload wins the start by ~130ms and loses the finish by ~1.4s,
            // because the  is in the first screenful of the document anyway
            // — the preload scanner finds it either way — and 45 KB is worth far
            // more than a head start on a link this slow. Page image bytes go
            // 249 KB -> 204 KB with it.
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
          />
          {/* Spotlight: a soft, bright pool that follows the pointer over the
              dark artwork, so mousing across the hero "reveals" light on the
              picture. Brightness concentrated at the cursor, fading to the
              page's dark base at the edges — only on hover-capable devices,
              never under reduced motion. */}
          {!reduce && (
            <div
              className="pointer-events-none absolute inset-0 z-10"
              style={{
                background: `radial-gradient(900px circle at ${pointerX * 100}% ${pointerY * 100}%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 60%)`,
              }}
            />
          )}
        </div>
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
            className="block size-full object-cover object-center motion-reduce:animate-none"
            fill
            sizes={COVER_POSTER_SIZES}
            intro
            style={{
              viewTransitionName: media.id ? `poster-${media.id}` : undefined,
            }}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
          />
        )
      )}
    </div>
  )
}
