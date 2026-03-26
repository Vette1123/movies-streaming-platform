'use client'

import React from 'react'
import { Share2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

interface ShareButtonProps {
  title: string
}

export function ShareButton({ title }: ShareButtonProps) {
  const handleShare = async () => {
    const url =
      typeof window !== 'undefined' ? window.location.href : ''

    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {}
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied to clipboard!')
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      className="gap-2 border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
    >
      <Share2 className="size-4" />
      Share
    </Button>
  )
}
