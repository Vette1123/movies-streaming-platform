'use client'

import React from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { toast } from 'sonner'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { trackSupportCtaClicked } from '@/lib/analytics'
import { getMediaTitle } from '@/lib/media'
import { cn } from '@/lib/utils'
import { useAccountIdentity } from '@/hooks/use-account'
import { useMounted } from '@/hooks/use-mounted'
import { MAX_NOTE, MAX_RATING, MIN_RATING, useReview } from '@/hooks/use-review'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  heroActionButtonBase,
  heroActionButtonIdle,
  heroActionButtonSaved,
} from '@/components/ui/hero-action-button'

/**
 * What YOU thought of it.
 *
 * The site has always shown TMDB's average and never your own verdict, and a
 * tracker without one is a log rather than a library. A score out of ten on the
 * same scale as the number already on the page, plus a line about why, saved to
 * the account and on every device the moment it lands.
 *
 * Supporter-only, and the gate is inside the dialog rather than on the button:
 * somebody who has never heard of this should be able to press it, read exactly
 * what it does, and decide — a control that does nothing when tapped teaches
 * nobody anything.
 */
export const RateButton = React.memo(function RateButton({
  media,
  className,
}: {
  media: MovieDetails & SeriesDetails
  className?: string
}) {
  const mounted = useMounted()
  const { pro } = useAccountIdentity()
  const { rating } = useReview(media)
  const [open, setOpen] = React.useState(false)

  // localStorage is client-only, so the server and the first client render both
  // show the neutral state or they disagree (React #418).
  const scored = mounted && pro === true && rating !== null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="lg"
          aria-label={scored ? `Your rating: ${rating}` : 'Rate this'}
          className={cn(
            heroActionButtonBase,
            scored ? heroActionButtonSaved : heroActionButtonIdle,
            className
          )}
        >
          <Star
            className={cn(
              'size-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]',
              scored && 'fill-amber-300 text-amber-300'
            )}
          />
          <span className="hidden sm:inline">
            {scored ? String(rating) : 'Rate'}
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        {pro ? (
          <RateForm media={media} onDone={() => setOpen(false)} />
        ) : (
          <RateOffer />
        )}
      </DialogContent>
    </Dialog>
  )
})

function RateOffer() {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Your own score, on everything you watch</DialogTitle>
        <DialogDescription className="leading-relaxed">
          Rate anything out of ten and leave yourself a line about why. It sits
          next to the title everywhere it appears, follows you to every device
          you sign in on, and turns a watch history into something you can
          actually look back through — which was it you gave a 9 to last spring?
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Link
          href="/support"
          onClick={() => trackSupportCtaClicked({ surface: 'rate_dialog' })}
          className={buttonVariants()}
        >
          See what support unlocks
        </Link>
      </DialogFooter>
    </>
  )
}

function RateForm({
  media,
  onDone,
}: {
  media: MovieDetails & SeriesDetails
  onDone: () => void
}) {
  const { rating, note, save, clear } = useReview(media)
  const [score, setScore] = React.useState(rating ?? 7)
  const [text, setText] = React.useState(note)
  const title = getMediaTitle(media)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-balance">Rate {title}</DialogTitle>
        <DialogDescription>
          Out of ten, on the same scale as the score on the page.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-2">
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <label htmlFor="rating" className="text-sm font-medium">
              Your rating
            </label>
            <span className="text-primary font-mono text-3xl font-semibold tabular-nums">
              {score.toFixed(1)}
            </span>
          </div>
          <input
            id="rating"
            type="range"
            min={MIN_RATING}
            max={MAX_RATING}
            step={0.5}
            value={score}
            onChange={(event) => setScore(Number(event.target.value))}
            // A native range input rather than a component: it is keyboard
            // accessible, screen-reader labelled and touch-draggable for free,
            // and no slider library is going to beat that.
            className="accent-primary h-2 w-full cursor-pointer"
          />
          <div className="text-muted-foreground flex justify-between text-xs">
            <span>{MIN_RATING}</span>
            <span>{MAX_RATING}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="note" className="text-sm font-medium">
            A line about why{' '}
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
          </label>
          <textarea
            id="note"
            rows={3}
            maxLength={MAX_NOTE}
            value={text}
            placeholder="Held up better than I expected."
            onChange={(event) => setText(event.target.value)}
            className="border-input bg-background focus-visible:ring-ring w-full resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-hidden"
          />
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        {rating !== null && (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive mr-auto"
            onClick={() => {
              clear()
              toast(`Rating removed from “${title}”`)
              onDone()
            }}
          >
            Remove
          </Button>
        )}
        <Button
          onClick={() => {
            save(score, text)
            toast.success(`You rated “${title}” ${score.toFixed(1)}`)
            onDone()
          }}
        >
          Save rating
        </Button>
      </DialogFooter>
    </>
  )
}
