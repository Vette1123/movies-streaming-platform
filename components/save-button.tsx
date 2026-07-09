'use client'

import React from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { cn } from '@/lib/utils'
import { useMounted } from '@/hooks/use-mounted'
import { useWatchlist } from '@/hooks/use-watchlist'
import { Button } from '@/components/ui/button'

interface SaveButtonProps {
  media: MovieDetails & SeriesDetails
  className?: string
}

export function SaveButton({ media, className }: SaveButtonProps) {
  const { isSaved, toggle } = useWatchlist()
  const isMounted = useMounted()

  // Until mounted, the saved state is unknown on the server (localStorage is
  // client-only), so we render the neutral "Save" state on both the server and
  // the first client render to stay hydration-safe (React #418).
  const saved = isMounted && isSaved(media.id)

  return (
    <Button
      type="button"
      variant={saved ? 'secondary' : 'outline'}
      size="lg"
      aria-pressed={saved}
      aria-label={saved ? 'Remove from watchlist' : 'Save to watchlist'}
      onClick={() => toggle(media)}
      className={cn(
        'gap-2 rounded-full backdrop-blur-sm transition-colors',
        !saved && 'bg-background/40 hover:bg-background/60',
        className
      )}
    >
      {saved ? (
        <BookmarkCheck className="size-5 text-cyan-300" />
      ) : (
        <Bookmark className="size-5" />
      )}
      <span>{saved ? 'Saved' : 'Save'}</span>
    </Button>
  )
}
