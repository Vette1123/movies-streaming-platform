'use client'

import React from 'react'
import { Share2 } from 'lucide-react'
import { toast } from 'sonner'

import { MediaKind, trackMediaShared } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface ShareButtonProps {
  title?: string
  mediaId?: number
  mediaType?: MediaKind
  className?: string
}

export function ShareButton({
  title,
  mediaId,
  mediaType,
  className,
}: ShareButtonProps) {
  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const shareData = {
      title: title || 'Reely',
      text: title ? `Watch “${title}” on Reely` : 'Check this out on Reely',
      url,
    }

    // Prefer the native share sheet (mobile / supported browsers). If the user
    // dismisses it that throws AbortError — we swallow it and do NOT fall back
    // to copying, since a cancel shouldn't silently mutate the clipboard.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
        trackMediaShared({
          media_id: mediaId,
          media_type: mediaType,
          title,
          method: 'web_share',
        })
      } catch {
        // user cancelled or share failed — nothing to do
      }
      return
    }

    // Desktop fallback: copy the link to the clipboard.
    try {
      await navigator.clipboard.writeText(url)
      trackMediaShared({
        media_id: mediaId,
        media_type: mediaType,
        title,
        method: 'clipboard',
      })
      toast.success('Link copied to clipboard')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      aria-label="Share"
      onClick={handleShare}
      className={cn(
        'bg-background/40 hover:bg-background/60 gap-2 rounded-full backdrop-blur-sm transition hover:scale-105 active:scale-95',
        className
      )}
    >
      <Share2 className="size-5" />
      <span>Share</span>
    </Button>
  )
}
