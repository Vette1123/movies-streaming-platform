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
import { hoursLabel, type LibraryStats } from '@/lib/stats'

/**
 * Your year, as an image worth posting.
 *
 * Drawn on a canvas in the browser rather than rendered by a server: the numbers
 * are already on this page, and an image endpoint would mean a Worker
 * invocation, a font fetch and a rendering library for something the device in
 * somebody's hand can draw in a millisecond. It also means the card works
 * offline and nothing about anyone's viewing is ever sent anywhere to make it.
 *
 * Frame size, palette and fitText live in lib/canvas-card.ts, shared with the
 * spoiler-free title card (lib/share-card.ts).
 */

interface Cell {
  value: string
  label: string
}

const cellsOf = (stats: LibraryStats): Cell[] => [
  { value: String(stats.films), label: 'films finished' },
  { value: String(stats.episodes), label: 'episodes' },
  { value: String(stats.seriesStarted), label: 'shows started' },
  {
    value: stats.streak > 1 ? `${stats.streak}` : '—',
    label: 'day streak',
  },
]

/** The small line above the headline. Says which year, when there is one. */
export const eyebrow = (year: number | null): string =>
  year === null ? 'MY YEAR ON REELY' : `MY ${year} ON REELY`

/**
 * The headline, from whichever of the two facts we have.
 *
 * Four cases rather than a nested ternary, and none of them says "undefined" or
 * leaves an apostrophe hanging — this is the biggest text on an image people
 * post somewhere public.
 */
export function headlineOf(name: string | null, year: number | null): string {
  if (name && year !== null) return `${name}'s ${year}`
  if (name) return `${name}'s viewing`
  if (year !== null) return `Everything in ${year}`
  return 'A year of viewing'
}

/** What the file is called once it leaves the browser. */
export const cardFileName = (year: number | null): string =>
  year === null ? 'reely-year.png' : `reely-${year}.png`

/**
 * Draw the card and hand back a PNG blob.
 *
 * Returns null when the canvas is unavailable, which is what a very old browser
 * or a hardened privacy mode looks like — the caller shows the copyable summary
 * instead rather than failing at somebody.
 */
export async function renderStatsCard(
  stats: LibraryStats,
  name: string | null,
  /** The year the figures cover, or null for a whole library. */
  year: number | null = null
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return null

  context.fillStyle = BACKDROP
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // A soft accent bloom behind the headline, so the card is not a rectangle of
  // flat navy with text on it.
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

  const margin = 88
  context.textBaseline = 'alphabetic'

  context.fillStyle = ACCENT
  context.font = `600 30px ${SANS}`
  context.letterSpacing = '6px'
  context.fillText(eyebrow(year), margin, 168)
  context.letterSpacing = '0px'

  context.fillStyle = INK
  const headline = headlineOf(name, year)
  const headlineSize = fitText(context, headline, CARD_WIDTH - margin * 2, 84)
  context.font = `700 ${headlineSize}px ${SANS}`
  context.fillText(headline, margin, 268)

  // The hours figure carries the card. Everything else is supporting detail, so
  // it is set at four times their size and given the accent.
  context.fillStyle = ACCENT
  context.font = `800 260px ${SANS}`
  context.fillText(String(stats.hours), margin, 560)

  const hoursWidth = context.measureText(String(stats.hours)).width
  context.fillStyle = MUTED
  context.font = `600 42px ${SANS}`
  context.fillText(hoursLabel(stats), margin + hoursWidth + 24, 560)

  // Two by two, because four numbers in a row at this width are unreadable on a
  // phone-sized thumbnail — which is the only size most people will see it.
  const cells = cellsOf(stats)
  const columnWidth = (CARD_WIDTH - margin * 2) / 2
  cells.forEach((cell, index) => {
    const x = margin + (index % 2) * columnWidth
    const y = 760 + Math.floor(index / 2) * 210

    context.strokeStyle = 'rgba(148, 163, 184, 0.22)'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(x, y - 96)
    context.lineTo(x + columnWidth - 40, y - 96)
    context.stroke()

    context.fillStyle = INK
    context.font = `700 92px ${SANS}`
    context.fillText(cell.value, x, y)

    context.fillStyle = MUTED
    context.font = `500 30px ${SANS}`
    context.fillText(cell.label, x, y + 46)
  })

  context.fillStyle = MUTED
  context.font = `500 30px ${SANS}`
  context.fillText(
    stats.saved > 0 ? `${stats.saved} more saved for later` : 'Still counting',
    margin,
    CARD_HEIGHT - 132
  )

  context.fillStyle = INK
  context.font = `700 36px ${SANS}`
  context.fillText('reely.space', margin, CARD_HEIGHT - 76)

  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  )
}
