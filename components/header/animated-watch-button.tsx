'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { Icons } from '@/components/icons'

interface AnimatedWatchButtonProps {
  movieId: number
}

export const AnimatedWatchButton = ({ movieId }: AnimatedWatchButtonProps) => {
  return (
    <motion.div
      className={cn('flex justify-center lg:w-fit lg:justify-start')}
      whileHover={{ scale: 1.1 }}
      transition={{ type: 'spring', stiffness: 500 }}
      initial={{ opacity: 0, y: 80 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Link
        href={`/movies/${movieId}`}
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
