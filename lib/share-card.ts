import {
  ACCENT,
  BACKDROP,
  CARD_HEIGHT,
  CARD_WIDTH,
  fitText,
  INK,
  MUTED,
  SANS,
} from '@/lib/canvas-card'

/**
 * The title as a picture somebody can post.
 *
 * The rule that shaped this file: it may only ever read bibliographic fields —
 * title, year, genres, score, key art. Never the synopsis, never a tagline, never
 * an episode title. Spoiler-safety lives in the SIGNATURE (what the renderer is
 * allowed to read), not in a deny-list checked at the call site, because a
 * deny-list rots the first time somebody adds a "just this one line" to the
 * payload. There is nowhere for a spoiler to enter.
 *
 * Drawn on a canvas in the visitor's browser, like lib/stats-card.ts — no Worker
 * invocation, no font fetch, nothing about anyone's viewing sent anywhere. The
 * image CDN composes the site's unfurl cards in the URL (lib/og/mosaic.ts), but
 * that cannot read per-title text without a Worker round-trip per share, and a
 * card that already has the page's own data on it should cost zero.
 */

/** Above the headline. Says which site, when there was ever any doubt. */
export const shareCardEyebrow = 'ON REELY'

/** What the file is called once it leaves the browser. */
export const shareCardFileName = (title: string): string => {
  const slug = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return `reely-${slug || 'title'}.png`
}

/**
 * The line under the headline: year and up to three genres, in that order.
 * Returns null when there is nothing to say — the caller then draws one line
 * fewer rather than a run of spaces.
 */
export function shareCardMetaLine(
  year?: number | null,
  genres?: string[]
): string | null {
  const parts: string[] = []
  if (year) parts.push(String(year))
  const names = (genres ?? []).filter(Boolean).slice(0, 3)
  if (names.length) parts.push(names.join(', '))
  return parts.length ? parts.join(' · ') : null
}

/**
 * The score line, matching the precedence the page's own chip uses
 * (components/media/score-chip.tsx): a real IMDb score when TMDB's payload
 * carries one, the rounded TMDB average otherwise, nothing when there is no
 * number to print. "NR" is the chip's answer because a chip occupies a fixed
 * slot; a card has room to simply omit the line.
 */
export function shareCardRatingLine(
  imdbRating?: string | null,
  voteAverage?: number | null
): string | null {
  const imdb = Number(imdbRating)
  if (imdbRating && Number.isFinite(imdb) && imdb > 0) {
    return `IMDb ${imdbRating}`
  }
  if (typeof voteAverage === 'number' && voteAverage > 0) {
    return `★ ${Math.round(voteAverage * 10) / 10} TMDB`
  }
  return null
}

export interface ShareCardInput {
  title: string
  /** Release / first-air year. Omitted when TMDB has no date. */
  year?: number | null
  /** Genre names, in TMDB's order. The first three are drawn. */
  genres?: string[]
  /** Already formatted — see shareCardRatingLine. */
  rating?: string | null
  /**
   * Full-bleed art, backdrop preferred. The caller builds the URL; null (or the
   * data-URI placeholder every image builder returns for a missing path) draws
   * the flat card instead.
   */
  artUrl?: string | null
}

/**
 * A hung CDN must not spin the button forever. On timeout the card still draws,
 * without art — the share is delayed a moment, not lost.
 */
const IMAGE_TIMEOUT_MS = 8000

/**
 * Load art for the canvas, or null.
 *
 * `crossOrigin = 'anonymous'` is not optional: without it the draw taints the
 * canvas and `toBlob` throws a SecurityError, so the share would fail on the
 * one path that actually worked. All three hosts in the image chain (ImageKit,
 * wsrv.nl, TMDB origin) answer with `Access-Control-Allow-Origin: *`, so a host
 * that does not means the load FAILS here — which is the correct outcome: a
 * card without art beats a card that cannot be exported.
 *
 * data: URIs (the empty-path placeholder) are treated as no art: they would
 * load fine and paint a transparent pixel over the whole frame.
 */
function loadArt(
  url: string | null | undefined
): Promise<HTMLImageElement | null> {
  if (!url || url.startsWith('data:')) return Promise.resolve(null)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    let settled = false
    const done = (image: HTMLImageElement | null) => {
      if (settled) return
      settled = true
      resolve(image)
    }
    const timer = setTimeout(() => done(null), IMAGE_TIMEOUT_MS)
    img.onload = () => {
      clearTimeout(timer)
      done(img.naturalWidth > 0 ? img : null)
    }
    img.onerror = () => {
      clearTimeout(timer)
      done(null)
    }
    img.src = url
  })
}

/** object-cover maths: fill the frame, centre the overflow. */
function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement
): void {
  const scale = Math.max(
    CARD_WIDTH / image.naturalWidth,
    CARD_HEIGHT / image.naturalHeight
  )
  const width = image.naturalWidth * scale
  const height = image.naturalHeight * scale
  context.drawImage(
    image,
    (CARD_WIDTH - width) / 2,
    (CARD_HEIGHT - height) / 2,
    width,
    height
  )
}

/** The stats card's accent bloom, for a card with no art of its own. */
function drawBloom(context: CanvasRenderingContext2D): void {
  const glow = context.createRadialGradient(
    CARD_WIDTH * 0.78,
    CARD_HEIGHT * 0.16,
    0,
    CARD_WIDTH * 0.78,
    CARD_HEIGHT * 0.16,
    CARD_WIDTH * 0.85
  )
  glow.addColorStop(0, 'rgba(244, 63, 94, 0.22)')
  glow.addColorStop(1, 'rgba(244, 63, 94, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
}

/**
 * Two scrims so white text survives whatever frame is behind it: a short one at
 * the top for the eyebrow, a long one at the bottom where the copy lives. The
 * backdrop is marketing key art under a gradient — it cannot say anything a
 * synopsis could.
 */
function drawScrims(context: CanvasRenderingContext2D): void {
  const top = context.createLinearGradient(0, 0, 0, 320)
  top.addColorStop(0, 'rgba(11, 17, 32, 0.75)')
  top.addColorStop(1, 'rgba(11, 17, 32, 0)')
  context.fillStyle = top
  context.fillRect(0, 0, CARD_WIDTH, 320)

  const bottom = context.createLinearGradient(
    0,
    CARD_HEIGHT - 640,
    0,
    CARD_HEIGHT
  )
  bottom.addColorStop(0, 'rgba(11, 17, 32, 0)')
  bottom.addColorStop(0.55, 'rgba(11, 17, 32, 0.82)')
  bottom.addColorStop(1, 'rgba(11, 17, 32, 0.96)')
  context.fillStyle = bottom
  context.fillRect(0, CARD_HEIGHT - 640, CARD_WIDTH, 640)
}

/**
 * Draw the card and hand back a PNG blob.
 *
 * Returns null when there is no title to put on it or the canvas is unavailable
 * (a very old browser, a hardened privacy mode) — the caller says so rather
 * than failing at somebody, exactly like renderStatsCard.
 */
export async function renderShareCard({
  title,
  year,
  genres,
  rating,
  artUrl,
}: ShareCardInput): Promise<Blob | null> {
  if (!title) return null

  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return null

  const art = await loadArt(artUrl)

  context.fillStyle = BACKDROP
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  if (art) drawCover(context, art)
  else drawBloom(context)
  drawScrims(context)

  const margin = 88
  context.textBaseline = 'alphabetic'

  context.fillStyle = ACCENT
  context.font = `600 30px ${SANS}`
  context.letterSpacing = '6px'
  context.fillText(shareCardEyebrow, margin, 150)
  context.letterSpacing = '0px'

  context.fillStyle = INK
  const headlineSize = fitText(context, title, CARD_WIDTH - margin * 2, 84)
  context.font = `700 ${headlineSize}px ${SANS}`
  context.fillText(title, margin, CARD_HEIGHT - 340)

  const meta = shareCardMetaLine(year, genres)
  let y = CARD_HEIGHT - 268
  if (meta) {
    context.fillStyle = MUTED
    context.font = `500 36px ${SANS}`
    context.fillText(meta, margin, y)
    y += 56
  }
  if (rating) {
    context.fillStyle = ACCENT
    context.font = `700 40px ${SANS}`
    context.fillText(rating, margin, y)
  }

  context.fillStyle = INK
  context.font = `700 36px ${SANS}`
  context.fillText('reely.space', margin, CARD_HEIGHT - 76)

  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  )
}
