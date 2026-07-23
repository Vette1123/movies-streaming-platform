'use client'

import React from 'react'
import { Play } from 'lucide-react'

import { MediaKind, trackTrailerPlayed } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface TrailerDialogProps {
  trailerKey: string
  mediaId: number
  mediaType: MediaKind
  title?: string
  // Notified whenever the dialog opens/closes (e.g. so a host carousel can
  // pause autoplay while the trailer is open).
  onOpenChange?: (open: boolean) => void
}

export function TrailerDialog({
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
          className="w-11 gap-0 rounded-full border border-white/30 bg-white/5 px-0 text-white shadow-none backdrop-blur-[2px] transition duration-200 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)] hover:border-white/50 hover:bg-white/10 active:scale-95 sm:w-auto sm:gap-2 sm:px-8"
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
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
