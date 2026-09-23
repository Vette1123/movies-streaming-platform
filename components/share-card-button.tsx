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
import { useIntentProps } from '@/hooks/use-prefetch-intent'
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

  // The card, drawn once and kept. Started on INTENT (hover, focus, the first
  // touch) rather than on the click: `navigator.share` has to run inside the
  // browser's user-activation window, and every millisecond of art load spent
  // before the click is one not spent inside it.
  //
  // Keyed by id: a client navigation can hand this same instance the next
  // title. A failed render resolves null (a hover nobody followed up must not
  // surface as an unhandled rejection) and is forgotten, so the next press
  // draws again.
  const card = React.useRef<{
    id: number
    blob: Promise<Blob | null>
  } | null>(null)
  const warm = React.useCallback(() => {
    const title = getMediaTitle(media)
    if (!title || card.current?.id === media.id) return
    const artPath = artPathOf(media)
    const entry = {
      id: media.id,
      blob: renderShareCard({
        title,
        year: getReleaseYear(getMediaReleaseDate(media)),
        genres: genreNames(media.genres),
        rating: shareCardRatingLine(media.imdbRating, media.vote_average),
        artUrl: artPath ? getImageURL(artPath) : null,
      }).catch(() => {
        if (card.current === entry) card.current = null
        return null
      }),
    }
    card.current = entry
  }, [media])
  const intent = useIntentProps(warm)

  const handleShare = async () => {
    const title = getMediaTitle(media)
    if (!title) return
    setBusy(true)
    try {
      warm()
      const blob = await card.current?.blob
      if (!blob) {
        // A failed draw, or a browser with no canvas: either way, a retry is
        // the only move, and a failed draw has already been forgotten.
        toast('Could not draw the card. Try again.')
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
        text: `Watch “${title}” on Reely: ${link}`,
      })
      if (outcome === 'shared') trackCard('card_share')
      if (outcome === 'downloaded') {
        trackCard('card_download')
        toast.success(`Saved ${file.name}`)
      }
    } catch {
      // The draw resolves null on failure and the share falls back to a
      // download (see lessons/2026-08-24-a-failed-share-sheet-is-not-a-dismissal),
      // so this is the belt to those braces.
      toast.error('Could not share the card')
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
      {...intent}
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
