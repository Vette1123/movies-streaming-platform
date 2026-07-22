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
  // it finished before first paint) we flip to "loaded" instantly and the blur
  // is never painted. This matters because the optimized images are small enough
  // to decode in a single frame: without this, onLoad still fires one frame
  // after a `blur-lg` commit, flashing a blur on an image that's already visible
  // — the flicker seen on a list scrolling in below the viewport edge. The
  // blur-in still plays for genuine network loads, where it sits behind real
  // fetch time and reads as a smooth reveal.
  const imgRef = React.useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0) setLoading(false)
  }, [])

  const blurClassName = cn(className, 'duration-700 ease-in-out', {
    'blur-lg': isLoading,
    'blur-0': !isLoading,
  })

  return intro ? (
    <Image
      {...props}
      ref={imgRef}
      alt={alt}
      src={imgSrc}
      className={blurClassName}
      onLoad={() => setLoading(false)}
      onError={handleError}
    />
  ) : (
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
