'use client'

import React, { useState } from 'react'
import { Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

interface TrailerButtonProps {
  trailerKey: string
}

export function TrailerButton({ trailerKey }: TrailerButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2 border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
      >
        <Play className="size-4 fill-current" />
        Trailer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0">
          <DialogTitle className="sr-only">Trailer</DialogTitle>
          <div className="aspect-video w-full">
            {open && (
              <iframe
                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
                className="size-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
