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

  return intro ? (
    <Image
      {...props}
      alt={alt}
      src={imgSrc}
      className={cn(className, 'duration-700 ease-in-out', {
        'blur-lg': isLoading,
        'blur-0': !isLoading,
      })}
      onLoad={() => setLoading(false)}
      onError={handleError}
    />
  ) : (
    <div className="w-fit overflow-hidden rounded-lg bg-slate-900">
      <Image
        {...props}
        alt={alt}
        src={imgSrc}
        className={cn(className, 'duration-700 ease-in-out', {
          'blur-lg': isLoading,
          'blur-0': !isLoading,
        })}
        onLoad={() => setLoading(false)}
        onError={handleError}
      />
    </div>
  )
}
