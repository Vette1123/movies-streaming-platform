'use client'

import React from 'react'
import Image, { ImageProps } from 'next/image'

import { cn } from '@/lib/utils'

interface BlurImageProps extends ImageProps {
  src: string
  alt: string
  className: string
  width?: number
  height?: number
}

export function BlurredImage({
  src,
  alt,
  className,
  width,
  height,
  ...props
}: BlurImageProps) {
  const [isLoading, setLoading] = React.useState(true)

  return (
    <div className="w-fit overflow-hidden rounded-lg bg-slate-900">
      <Image
        {...props}
        alt={alt}
        src={src}
        width={width}
        height={height}
        className={cn(className, 'duration-700 ease-in-out', {
          'blur-lg': isLoading,
          'blur-0': !isLoading,
        })}
        onLoadingComplete={() => setLoading(false)}
      />
    </div>
  )
}
