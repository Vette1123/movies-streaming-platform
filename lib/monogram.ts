import type { CSSProperties } from 'react'

/**
 * What a card shows when TMDB has no image. A grey box said "something failed
 * to load"; a tinted card with initials or a glyph says "no photo", and the
 * tint, picked from the name, tells three photo-less producers in a row apart
 * at a glance.
 */

/** First letter of the first and last word: "Matt O'Brien" → "MO", "Cher" → "C". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  // Array.from, not [0]: a name starting with an astral character (emoji, some
  // CJK) would otherwise yield half a surrogate pair.
  const first = Array.from(words[0])[0]
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : ''
  return (first + last).toUpperCase()
}

/**
 * Eight hues far enough apart to read as different colours on a dark card.
 * A free 0-359 hue let two neighbours land 10° apart, which is the same purple
 * to anybody looking (Matt O'Brien and Tracy King, side by side on Conan).
 */
const HUES = [215, 265, 320, 350, 25, 45, 160, 190] as const

/** A stable hue for a name: the same person is the same colour on every page and every build. */
export function tintHue(name: string): number {
  let hash = 0x811c9dc5
  // FNV-1a, then a final avalanche: a plain *31 hash left names of similar
  // length clustered on a few buckets.
  for (const ch of name) hash = Math.imul(hash ^ ch.codePointAt(0)!, 0x01000193)
  hash = Math.imul(hash ^ (hash >>> 15), 0x2c1b3c6d)
  hash ^= hash >>> 12
  return HUES[(hash >>> 0) % HUES.length]
}

/**
 * The fallback's background: a soft glow of the name's hue from the top over a
 * deep two-tone wash. Static gradients only — one paint, no layer, no blur.
 */
export function tintBackground(name: string): CSSProperties {
  const h = tintHue(name)
  return {
    backgroundImage: `radial-gradient(120% 70% at 50% 0%, hsl(${h} 60% 32% / 0.85), transparent 70%), linear-gradient(160deg, hsl(${h} 35% 17%), hsl(${(h + 40) % 360} 40% 8%))`,
  }
}
