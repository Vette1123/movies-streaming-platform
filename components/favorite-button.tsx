'use client'

import React from 'react'
import { Heart } from 'lucide-react'
import posthog from 'posthog-js'
import { toast } from 'sonner'

import { FavoriteItem, useFavorites } from '@/hooks/use-favorites'
import { cn } from '@/lib/utils'

interface FavoriteButtonProps {
  item: Omit<FavoriteItem, 'added_at'>
  className?: string
  /** When true, renders as an inline button instead of absolute-positioned overlay */
  inline?: boolean
}

export function FavoriteButton({ item, className, inline = false }: FavoriteButtonProps) {
  const { isFavorite, toggle, mounted } = useFavorites()

  if (!mounted) return null

  const favorited = isFavorite(item.id)

  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const wasFav = isFavorite(item.id)
        posthog.capture(wasFav ? 'unfavorited' : 'favorited', {
          media_id: item.id,
          media_title: item.title,
          media_type: item.type,
        })
        toggle(item)
        toast(wasFav ? 'Removed from watchlist' : 'Added to watchlist', {
          icon: wasFav ? '💔' : '❤️',
          duration: 2000,
        })
      }}
      className={cn(
        'rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm transition-colors hover:bg-black/80',
        !inline && 'absolute right-2 top-2 z-10',
        inline && 'relative flex items-center gap-1.5 px-3 py-1.5',
        className
      )}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart
        className={cn('size-4', favorited && 'fill-red-500 text-red-500')}
      />
    </button>
  )
}
