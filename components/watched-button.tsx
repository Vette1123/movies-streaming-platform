'use client'

import React from 'react'
import { Check, Eye } from 'lucide-react'
import { toast } from 'sonner'

import { MovieDetails } from '@/types/movie-details'
import { cn } from '@/lib/utils'
import { useCompletedMedia } from '@/hooks/use-completed-media'
import { useMounted } from '@/hooks/use-mounted'
import { Button } from '@/components/ui/button'

interface WatchedButtonProps {
  movie: MovieDetails
  className?: string
}

// Manual "I've watched this" toggle for a movie. Companion to SaveButton — same
// pill styling, but writes to the completed set (see use-completed-media.ts).
export function WatchedButton({ movie, className }: WatchedButtonProps) {
  const { isMovieCompleted, toggleMovieCompleted } = useCompletedMedia()
  const isMounted = useMounted()

  // localStorage is client-only, so render the neutral state on the server and
  // first client render to stay hydration-safe (matches SaveButton, React #418).
  const watched = isMounted && isMovieCompleted(movie.id)

  const handleClick = () => {
    // `watched` is the pre-toggle state, so it tells us which way we're flipping.
    toggleMovieCompleted(movie)
    if (watched) {
      toast(`Marked “${movie.title}” as not watched`)
    } else {
      toast.success(`Marked “${movie.title}” as watched`)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="lg"
      aria-pressed={watched}
      aria-label={watched ? 'Mark as not watched' : 'Mark as watched'}
      onClick={handleClick}
      className={cn(
        'w-11 gap-0 rounded-full border px-0 text-white shadow-none backdrop-blur-[2px] transition duration-200 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)] active:scale-95 sm:w-auto sm:gap-2 sm:px-8',
        watched
          ? 'border-emerald-300/60 bg-emerald-400/10 hover:bg-emerald-400/20'
          : 'border-white/30 bg-white/5 hover:border-white/50 hover:bg-white/10',
        className
      )}
    >
      {watched ? (
        <Check className="size-5 text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
      ) : (
        <Eye className="size-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
      )}
      <span className="hidden sm:inline">{watched ? 'Watched' : 'Mark watched'}</span>
    </Button>
  )
}
