'use client'

import React from 'react'

import { heroTitleState } from '@/lib/hero-title'
import { imageShown, rememberImage } from '@/lib/image-memory'
import {
  cn,
  getLogoImageSrcSet,
  getLogoImageURL,
  LOGO_SIZES,
} from '@/lib/utils'

// The display title both heroes share: the official wordmark when TMDB has
// one, the plain title in the same type otherwise. It lived inline in the
// homepage slide, and the detail page carried its own smaller, plain <h1> —
// so the same film looked like two different products a click apart. Sizes,
// shadow and the crossfade rule are written once here.
export const HERO_TITLE_TEXT =
  'text-3xl font-bold tracking-tight text-balance text-white drop-shadow-md sm:text-4xl lg:text-6xl'

interface HeroWordmarkProps {
  /** h1 on a detail page, h2 inside the homepage carousel. */
  as: 'h1' | 'h2'
  title: string
  logoPath?: string | null
  /** The logo lookup has resolved, so `logoPath` is final. */
  extrasReady: boolean
  /** The first-paint grace is over; a slow logo may be covered by text. */
  graceElapsed?: boolean
  loading: 'eager' | 'lazy'
  fetchPriority?: 'high' | 'auto'
  /** The wordmark decoded or failed — its fate is known. */
  onSettle?: () => void
  className?: string
}

export function HeroWordmark({
  as: Heading,
  title,
  logoPath,
  extrasReady,
  graceElapsed,
  loading,
  fetchPriority = 'auto',
  onSettle,
  className,
}: HeroWordmarkProps) {
  const [logoError, setLogoError] = React.useState(false)
  const [logoLoaded, setLogoLoaded] = React.useState(false)

  const logoUrl = logoPath ? getLogoImageURL(logoPath) : null

  const markLoaded = React.useCallback(
    (node: HTMLImageElement) => {
      rememberImage(logoUrl, node)
      onSettle?.()
      setLogoLoaded(true)
    },
    [logoUrl, onSettle]
  )
  const markError = React.useCallback(() => {
    onSettle?.()
    setLogoError(true)
  }, [onSettle])
  // onLoad alone is NOT enough for a server-rendered <img>. The logo ships in
  // the SSR HTML, so on a warm cache the browser decodes it before React
  // hydrates and attaches the listener — the event has already fired, nothing
  // is listening, and logoLoaded stays false forever. A ref callback runs at
  // attach time and can read img.complete, catching exactly the case the event
  // misses. naturalWidth tells a decoded image from a completed-but-broken one.
  const logoRef = React.useCallback(
    (node: HTMLImageElement | null) => {
      if (!node?.complete) return
      if (node.naturalWidth > 0) markLoaded(node)
      else markError()
    },
    [markLoaded, markError]
  )

  // Logo vs text: see lib/hero-title.ts. The wordmark is visible from the
  // server HTML on; JS only ever decides whether the text covers for it.
  const { logo: showLogo, text: showText } = heroTitleState({
    hasLogo: !!logoPath,
    // Already shown in this tab: Back must not cover it with the plain title.
    logoLoaded: logoLoaded || imageShown(logoUrl),
    logoError,
    extrasReady,
    graceElapsed: graceElapsed ?? true,
  })

  if (!showLogo) {
    return (
      <Heading
        className={cn(
          HERO_TITLE_TEXT,
          'transition-opacity duration-300 ease-out',
          showText ? 'opacity-100' : 'opacity-0',
          className
        )}
      >
        {title}
      </Heading>
    )
  }

  // The heading wraps both treatments, so it always names the title: the text
  // while it is up, the image's alt once the wordmark has landed (the text is
  // then hidden from assistive tech, so the name is never read twice). The
  // box reserves the logo's height, so there is no jump when it decodes.
  return (
    <Heading
      className={cn(
        'relative flex min-h-16 w-full items-end sm:min-h-20 lg:min-h-32',
        className
      )}
    >
      <span
        aria-hidden={logoLoaded}
        // Fades IN only (as a fallback); it leaves instantly when the wordmark
        // lands, so the two never overlap on screen.
        className={cn(
          HERO_TITLE_TEXT,
          'transition-opacity duration-300 ease-out',
          showText ? 'hero-gradient-text opacity-100' : 'opacity-0',
          className
        )}
      >
        {title}
      </span>
      <img
        ref={logoRef}
        src={logoUrl!}
        // A plain <img> gets no srcset from next/image, so the widths are
        // written by hand: see getLogoImageSrcSet.
        srcSet={getLogoImageSrcSet(logoPath!)}
        sizes={LOGO_SIZES}
        alt={title}
        fetchPriority={fetchPriority}
        loading={loading}
        // A native image drag would ghost the logo and, in the carousel, eat
        // the swipe that started on it.
        draggable={false}
        onError={markError}
        onLoad={(event) => markLoaded(event.currentTarget)}
        // No opacity gate, no fade: the browser paints the wordmark the instant
        // it decodes, before React has even hydrated.
        className="absolute bottom-0 left-0 max-h-16 w-auto max-w-[80%] object-contain object-left drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] sm:max-h-20 lg:max-h-32"
      />
    </Heading>
  )
}
