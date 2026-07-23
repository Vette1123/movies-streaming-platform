'use client'

import React from 'react'
import Image, { ImageProps } from 'next/image'

import { getNextImageFallback } from '@/lib/tmdbConfig'
import { cn } from '@/lib/utils'

interface BlurImageProps extends ImageProps {
  className: string
  intro?: boolean
}

export function BlurredImage({
  src,
  alt,
  className,
  intro = false,
  ...props
}: BlurImageProps) {
  const [isLoading, setLoading] = React.useState(true)
  // Render from this src so we can walk the fallback chain if a URL fails:
  // ImageKit -> wsrv.nl -> TMDB origin. Each onError advances one stage. Kept in
  // sync when `src` changes so recycled instances in lists don't show a stale
  // fallback.
  const [imgSrc, setImgSrc] = React.useState(src)

  React.useEffect(() => {
    setImgSrc(src)
  }, [src])

  const handleError = React.useCallback(() => {
    const fallback = getNextImageFallback(imgSrc)
    if (fallback && fallback !== imgSrc) setImgSrc(fallback)
  }, [imgSrc])

  // next/image forwards `ref` to the underlying <img> (Next 16). A callback ref
  // runs synchronously during commit — before the browser paints — so when the
  // image is ALREADY complete at mount (cache hit, or decoded fast enough that
  // it finished before first paint) we flip to "loaded" instantly and no reveal
  // animation is ever painted. This is what keeps a cached list-scroll from
  // flashing. The reveal below only plays for genuine network loads, where it
  // sits behind real fetch time and reads as a smooth fade.
  const imgRef = React.useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0) setLoading(false)
  }, [])

  // Intrinsic (width+height) usage — poster cards in grids and rails. Reserve
  // the exact box with `aspect-ratio` BEFORE the image loads (no CLS / no
  // neighbour overflow: `w-full` shrinks to the grid track / rail item instead
  // of the old `w-fit`, which forced the <img>'s native 250px). The reveal is a
  // dark-placeholder crossfade layered ON TOP of the image, so it never touches
  // the image's own `transition-transform` hover-scale — the previous approach
  // toggled `blur-lg`→`blur-0` on an element whose transition-property was only
  // `transform`, so the blur snapped off with no easing (the "flash").
  const hasIntrinsic =
    typeof props.width === 'number' && typeof props.height === 'number'

  if (intro) {
    // Hero / large single posters: deliberate blur-up reveal behind network time.
    const blurClassName = cn(className, 'duration-700 ease-in-out', {
      'blur-lg': isLoading,
      'blur-0': !isLoading,
    })
    return (
      <>
        {/* Dark backing so the hero isn't blank before the image has any pixels.
            The backdrop is an opaque photo that covers this the instant it paints,
            so no opacity/transition is needed here — a static fill is enough and
            costs nothing at runtime (no state coupling, no compositor work). It
            fills the same `relative` parent the `fill` image positions against and
            sits behind it by DOM order. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-slate-900"
        />
        <Image
          {...props}
          ref={imgRef}
          alt={alt}
          src={imgSrc}
          className={blurClassName}
          onLoad={() => setLoading(false)}
          onError={handleError}
        />
      </>
    )
  }

  if (hasIntrinsic) {
    // Reserve the exact box via aspect-ratio, then let the image `fill` it. Using
    // `fill` (not the width/height props as CSS-sized) is the canonical next/image
    // pattern for a responsive box and avoids the "width/height modified" distortion
    // warning. width/height are stripped so `fill` isn't passed alongside them.
    const { width, height, ...rest } = props
    return (
      <div
        className="relative w-full overflow-hidden rounded-lg bg-slate-900"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <Image
          {...rest}
          ref={imgRef}
          alt={alt}
          src={imgSrc}
          fill
          className={cn(className, 'object-cover')}
          onLoad={() => setLoading(false)}
          onError={handleError}
        />
        {/* Dark placeholder that fades out once the image paints. Smooth reveal,
            no blur-snap, and independent of the image's hover transform. */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 bg-slate-900 transition-opacity duration-500 ease-out',
            isLoading ? 'opacity-100' : 'opacity-0'
          )}
        />
      </div>
    )
  }

  // Non-intro `fill` usage (e.g. collection banner): the image is absolutely
  // positioned against an outer `relative` parent, so keep the light wrapper.
  const blurClassName = cn(className, 'duration-700 ease-in-out', {
    'blur-lg': isLoading,
    'blur-0': !isLoading,
  })
  return (
    <div className="w-fit overflow-hidden rounded-lg bg-slate-900">
      <Image
        {...props}
        ref={imgRef}
        alt={alt}
        src={imgSrc}
        className={blurClassName}
        onLoad={() => setLoading(false)}
        onError={handleError}
      />
    </div>
  )
}
