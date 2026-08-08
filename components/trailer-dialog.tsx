'use client'

import React from 'react'
import { Play } from 'lucide-react'

import { MediaKind, trackTrailerPlayed } from '@/lib/analytics'
import { YOUTUBE_EMBED_ALLOW } from '@/lib/embed-policy'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  heroActionButtonBase,
  heroActionButtonIdle,
} from '@/components/ui/hero-action-button'

interface TrailerDialogProps {
  trailerKey: string
  mediaId: number
  mediaType: MediaKind
  title?: string
  // Notified whenever the dialog opens/closes (e.g. so a host carousel can
  // pause autoplay while the trailer is open).
  onOpenChange?: (open: boolean) => void
}

// Memoised: the hero passes primitives plus a `setState` function, all stable,
// so the Radix trigger + dialog subtree is built once per slide instead of on
// every re-render of the slide around it.
export const TrailerDialog = React.memo(function TrailerDialog({
  trailerKey,
  mediaId,
  mediaType,
  title,
  onOpenChange,
}: TrailerDialogProps) {
  const [open, setOpen] = React.useState(false)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    onOpenChange?.(next)
    if (next) {
      trackTrailerPlayed({ media_id: mediaId, media_type: mediaType, title })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          // Label is hidden < sm (icon-only), so name the button for screen
          // readers at every width.
          aria-label="Watch trailer"
          className={cn(heroActionButtonBase, heroActionButtonIdle)}
        >
          <Play className="text-primary size-5 fill-current drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
          <span className="hidden sm:inline">Trailer</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl overflow-hidden border-white/10 p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="pr-8 text-left text-base font-semibold">
            {title ? `${title} — Trailer` : 'Trailer'}
          </DialogTitle>
        </DialogHeader>
        <div className="aspect-video w-full">
          {/* Only mount the iframe while open so we never load YouTube for a
              trailer nobody opened. */}
          {open && (
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`}
              title={title ? `${title} trailer` : 'Trailer'}
              allow={YOUTUBE_EMBED_ALLOW}
              allowFullScreen
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
})
