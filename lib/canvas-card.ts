/**
 * Shared canvas-card primitives: the feed size, the palette, and the
 * shrink-to-fit headline helper.
 *
 * Two cards draw this way — lib/stats-card.ts (your year) and lib/share-card.ts
 * (the spoiler-free title card) — and a palette or a frame size that drifts
 * between them is an inconsistency nobody would catch in review.
 *
 * 1080x1350 is the 4:5 portrait that every feed crops least.
 */
export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350

// Fixed rather than read from the theme. A card is looked at somewhere else,
// where Reely's CSS variables do not exist, and `getComputedStyle` on a custom
// property can hand back an `oklch()` string that older canvas implementations
// refuse — a blank card is worse than one that ignores the accent.
export const INK = '#f8fafc'
export const MUTED = '#94a3b8'
export const ACCENT = '#f43f5e'
export const BACKDROP = '#0b1120'

export const SANS =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/** Fit a headline into the card by shrinking it, never by clipping it. */
export function fitText(
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
  // The floor: leave the context AT the size returned, not the last one tried.
  context.font = `${weight} ${size}px ${SANS}`
  return size
}

/** The accent bloom top-right, so a card is not flat navy with text on it. */
export function drawBloom(context: CanvasRenderingContext2D): void {
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
