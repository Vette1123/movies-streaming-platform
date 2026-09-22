'use client'

import React from 'react'
import { ImageDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { trackMediaShared } from '@/lib/analytics'
import {
  genreNames,
  getMediaReleaseDate,
  getMediaTitle,
  getReleaseYear,
  resolveMediaType,
} from '@/lib/media'
import {
  renderShareCard,
  shareCardFileName,
  shareCardRatingLine,
} from '@/lib/share-card'
import { cn, getImageURL } from '@/lib/utils'
import { isDismissal } from '@/hooks/use-share'
import { Button } from '@/components/ui/button'
import {
  heroActionButtonBase,
  heroActionButtonIdle,
} from '@/components/ui/hero-action-button'

interface ShareCardButtonProps {
  media: MovieDetails & SeriesDetails
  className?: string
}

/** Backdrop first (fills the 4:5 frame with the least crop), poster second. */
const artPathOf = (media: MovieDetails & SeriesDetails): string | null =>
  media.backdrop_path || media.poster_path || null

// Memoised like its siblings (SaveButton, RateButton): `media` is a server
// payload object and `className` a literal, so both are stable per call site.
export const ShareCardButton = React.memo(function ShareCardButton({
  media,
  className,
}: ShareCardButtonProps) {
  const [busy, setBusy] = React.useState(false)

  const trackCard = (method: 'card_share' | 'card_download') => {
    trackMediaShared({
      media_id: media.id,
      media_type: resolveMediaType(media),
      title: getMediaTitle(media),
      method,
    })
  }

  const handleShare = async () => {
    const title = getMediaTitle(media)
    if (!title) return
    setBusy(true)
    try {
      const artPath = artPathOf(media)
      const blob = await renderShareCard({
        title,
        year: getReleaseYear(getMediaReleaseDate(media)),
        genres: genreNames(media.genres),
        rating: shareCardRatingLine(media.imdbRating, media.vote_average),
        artUrl: artPath ? getImageURL(artPath) : null,
      })
      if (!blob) {
        toast('This browser cannot draw the card')
        return
      }
      const file = new File([blob], shareCardFileName(title), {
        type: 'image/png',
      })
      // canShare with the FILE, not just a share check: desktop Chrome has
      // navigator.share and refuses files, and calling share anyway throws.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title,
          text: `Watch “${title}” on Reely`,
        })
        trackCard('card_share')
        return
      }
      const url = URL.createObjectURL(file)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.click()
      URL.revokeObjectURL(url)
      trackCard('card_download')
      toast.success(`Saved ${file.name}`)
    } catch (error) {
      // A dismissed sheet is the one outcome that needs no fallback and no
      // words (see lessons/2026-08-24-a-failed-share-sheet-is-not-a-dismissal).
      if (!isDismissal(error)) toast.error('Could not share the card')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="lg"
      // Label is hidden < sm (icon-only), so name the button for screen
      // readers at every width.
      aria-label="Share card"
      disabled={busy}
      onClick={() => void handleShare()}
      className={cn(heroActionButtonBase, heroActionButtonIdle, className)}
    >
      {busy ? (
        <Loader2 className="size-5 animate-spin drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
      ) : (
        <ImageDown className="size-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" />
      )}
      <span className="hidden sm:inline">Share card</span>
    </Button>
  )
})
