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
}

export function TrailerDialog({
  trailerKey,
  mediaId,
  mediaType,
  title,
}: TrailerDialogProps) {
  const [open, setOpen] = React.useState(false)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
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
          className="gap-2 rounded-full border border-white/30 bg-white/5 text-white shadow-none backdrop-blur-[2px] transition duration-200 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)] hover:border-white/50 hover:bg-white/10 active:scale-95"
        >
          <Play className="text-primary size-5 fill-current drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
          <span>Trailer</span>
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
