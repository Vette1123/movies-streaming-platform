'use client'

import React from 'react'
import { ImageDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { MovieDetails } from '@/types/movie-details'
import { SeriesDetails } from '@/types/series-details'
import { siteConfig } from '@/config/site'
import { trackMediaShared } from '@/lib/analytics'
import {
  genreNames,
  getMediaReleaseDate,
  getMediaTitle,
  getReleaseYear,
  mediaDetailHref,
  resolveMediaType,
} from '@/lib/media'
import {
  renderShareCard,
  shareCardFileName,
  shareCardRatingLine,
} from '@/lib/share-card'
import { cn, getImageURL } from '@/lib/utils'
import { shareOrDownloadFile } from '@/hooks/use-share'
import { Button } from '@/components/ui/button'
import {
  heroActionButtonBase,
  heroActionButtonIdle,
} from '@/components/ui/hero-action-button'

interface ShareCardButtonProps {
  media: MovieDetails & SeriesDetails
  className?: string
}

/**
 * Backdrop first, poster second. Not for the crop — a 16:9 backdrop keeps
 * under half its width in a 4:5 frame, a poster most of its height — but
 * because posters carry their own title lettering, which would sit under the
 * card's title twice.
 */
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
      // The link rides in the text: a picture on its own leaves the recipient
      // nowhere to tap.
      const link = `${siteConfig.websiteURL}${mediaDetailHref(resolveMediaType(media), media.id)}`
      const outcome = await shareOrDownloadFile(file, {
        title,
        text: `Watch “${title}” on Reely — ${link}`,
      })
      if (outcome === 'shared') trackCard('card_share')
      if (outcome === 'downloaded') {
        trackCard('card_download')
        toast.success(`Saved ${file.name}`)
      }
    } catch {
      // Only the render can land here now — the share itself falls back to a
      // download (see lessons/2026-08-24-a-failed-share-sheet-is-not-a-dismissal).
      toast.error('Could not draw the card')
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
