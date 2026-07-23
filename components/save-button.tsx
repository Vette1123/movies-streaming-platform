'use client'

import React from 'react'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { toast } from 'sonner'

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

  const handleClick = () => {
    const title = media?.title || media?.name
    // `saved` is the pre-toggle state, so it tells us which way we're flipping.
    if (saved) {
      toggle(media)
      toast(`Removed “${title}” from your watchlist`)
    } else {
      toggle(media)
      toast.success(`Saved “${title}” to your watchlist`)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="lg"
      aria-pressed={saved}
      aria-label={saved ? 'Remove from watchlist' : 'Save to watchlist'}
      onClick={handleClick}
      className={cn(
        'w-11 gap-0 rounded-full border px-0 text-white shadow-none backdrop-blur-[2px] transition duration-200 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)] active:scale-95 sm:w-auto sm:gap-2 sm:px-8',
        saved
          ? 'border-cyan-300/60 bg-cyan-400/10 hover:bg-cyan-400/20'
          : 'border-white/30 bg-white/5 hover:border-white/50 hover:bg-white/10',
        className
      )}
    >
      {saved ? (
        <BookmarkCheck className="size-5 text-cyan-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
      ) : (
        <Bookmark className="size-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
      )}
      <span className="hidden sm:inline">{saved ? 'Saved' : 'Save'}</span>
    </Button>
  )
}
