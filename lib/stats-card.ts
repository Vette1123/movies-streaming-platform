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
 * 1080×1350 is the 4:5 portrait that every feed crops least.
 */
const WIDTH = 1080
const HEIGHT = 1350

// Fixed rather than read from the theme. A card is looked at somewhere else,
// where Reely's CSS variables do not exist, and `getComputedStyle` on a custom
// property can hand back an `oklch()` string that older canvas implementations
// refuse — a blank card is a worse outcome than one that ignores the accent.
const INK = '#f8fafc'
const MUTED = '#94a3b8'
const ACCENT = '#f43f5e'
const BACKDROP = '#0b1120'

const SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

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

/** Fit a headline into the card by shrinking it, never by clipping it. */
function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  weight = '700'
): number {
  let size = startPx
  do {
    context.font = `${weight} ${size}px ${SANS}`
    if (context.measureText(text).width <= maxWidth) return size
    size -= 4
  } while (size > 24)
  return size
}

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
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')
  if (!context) return null

  context.fillStyle = BACKDROP
  context.fillRect(0, 0, WIDTH, HEIGHT)

  // A soft accent bloom behind the headline, so the card is not a rectangle of
  // flat navy with text on it.
  const glow = context.createRadialGradient(
    WIDTH * 0.78,
    HEIGHT * 0.16,
    0,
    WIDTH * 0.78,
    HEIGHT * 0.16,
    WIDTH * 0.85
  )
  glow.addColorStop(0, 'rgba(244, 63, 94, 0.22)')
  glow.addColorStop(1, 'rgba(244, 63, 94, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, WIDTH, HEIGHT)

  const margin = 88
  context.textBaseline = 'alphabetic'

  context.fillStyle = ACCENT
  context.font = `600 30px ${SANS}`
  context.letterSpacing = '6px'
  context.fillText(eyebrow(year), margin, 168)
  context.letterSpacing = '0px'

  context.fillStyle = INK
  const headline = headlineOf(name, year)
  const headlineSize = fitText(context, headline, WIDTH - margin * 2, 84)
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
  const columnWidth = (WIDTH - margin * 2) / 2
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
    HEIGHT - 132
  )

  context.fillStyle = INK
  context.font = `700 36px ${SANS}`
  context.fillText('reely.space', margin, HEIGHT - 76)

  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  )
}
