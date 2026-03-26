'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { motion } from 'framer-motion'
import posthog from 'posthog-js'
import { toast } from 'sonner'

import { Movie } from '@/types/movie-result'
import { cn } from '@/lib/utils'
import { useFavorites } from '@/hooks/use-favorites'
import { buttonVariants } from '@/components/ui/button'
import { Icons } from '@/components/icons'

// Global flag so animation only plays once
let hasAnimated = false

export function HeroActions({ movie }: { movie: Movie }) {
  const [shouldAnimate, setShouldAnimate] = useState(!hasAnimated)
  const { isFavorite, toggle, mounted } = useFavorites()

  useEffect(() => {
    if (!hasAnimated) {
      hasAnimated = true
      setShouldAnimate(true)
    }
  }, [])

  const href =
    movie?.media_type === 'tv' ? `/tv-shows/${movie.id}` : `/movies/${movie.id}`

  const favorited = mounted && isFavorite(movie.id)

  const handleFavorite = () => {
    const wasFav = isFavorite(movie.id)
    posthog.capture(wasFav ? 'unfavorited' : 'favorited', {
      media_id: movie.id,
      media_title: movie.title || movie.name,
      media_type: movie.media_type,
    })
    toggle({
      id: movie.id,
      type: movie.media_type === 'tv' ? 'series' : 'movie',
      title: movie.title || movie.name || '',
      poster_path: movie.poster_path,
      release_date: movie.release_date || '',
      vote_average: movie.vote_average,
    })
    toast(wasFav ? 'Removed from watchlist' : 'Added to watchlist', {
      icon: wasFav ? '💔' : '❤️',
      duration: 2000,
    })
  }

  return (
    <motion.div
      className="mt-6 flex items-center gap-3 justify-center lg:justify-start"
      initial={shouldAnimate ? { opacity: 0, y: 80 } : { opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500 }}
    >
      <motion.div whileHover={{ scale: 1.05 }} transition={{ type: 'spring', stiffness: 500 }}>
        <Link
          href={href}
          className={cn(
            buttonVariants({ variant: 'watchNow', size: '2xl', className: 'rounded-full' })
          )}
        >
          <Icons.watch className="mr-2" />
          Watch Now
        </Link>
      </motion.div>

      {mounted && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 500 }}
          onClick={handleFavorite}
          aria-label={favorited ? 'Remove from watchlist' : 'Add to watchlist'}
          className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          <Heart
            className={cn(
              'size-5 transition-colors',
              favorited ? 'fill-red-500 text-red-500' : 'text-white'
            )}
          />
        </motion.button>
      )}
    </motion.div>
  )
}
