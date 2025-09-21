'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

import { ItemType } from '@/types/movie-result'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Icons } from '@/components/icons'

interface AnimatedWatchButtonProps {
  movieId: number
  mediaType?: ItemType
}

// Global variable to track if animation has played
let hasAnimated = false

export const AnimatedWatchButton = ({
  movieId,
  mediaType,
}: AnimatedWatchButtonProps) => {
  const [shouldAnimate, setShouldAnimate] = useState(!hasAnimated)

  useEffect(() => {
    if (!hasAnimated) {
      hasAnimated = true
      setShouldAnimate(true)
    }
  }, [])

  const href =
    mediaType === 'tv' ? `/tv-shows/${movieId}` : `/movies/${movieId}`

  return (
    <motion.div
      className={cn('flex justify-center lg:w-fit lg:justify-start')}
      whileHover={{ scale: 1.1 }}
      transition={{ type: 'spring', stiffness: 500 }}
      initial={shouldAnimate ? { opacity: 0, y: 80 } : { opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Link
        href={href}
        className={cn(
          'mt-6',
          buttonVariants({
            variant: 'watchNow',
            size: '2xl',
            className: 'rounded-full',
          })
        )}
      >
        <Icons.watch className="mr-2" />
        Watch Now
      </Link>
    </motion.div>
  )
}
