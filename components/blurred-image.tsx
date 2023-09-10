'use client'

import React from 'react'
import Image, { ImageProps } from 'next/image'

import { cn } from '@/lib/utils'

interface BlurImageProps extends ImageProps {
  src: string
  alt: string
  className: string
  width: number
  height: number
}

export default function BlurImage({
  src,
  alt,
  className,
  width,
  height,
  ...props
}: BlurImageProps) {
  const [isLoading, setLoading] = React.useState(true)

  return (
    <div className="w-full overflow-hidden rounded-lg bg-slate-900">
      <Image
        {...props}
        alt={alt}
        src={src}
        width={width}
        height={height}
        className={cn(className, 'duration-700 ease-in-out', {
          'blur-2xl grayscale': isLoading,
          'blur-0 grayscale-0': !isLoading,
        })}
        onLoadingComplete={() => setLoading(false)}
      />
    </div>
  )
}
