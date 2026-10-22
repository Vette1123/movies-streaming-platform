/**
 * Text direction configuration.
 *
 * The site is English-only today, so `dir="ltr"` is baked into app/layout.tsx.
 * This module is the single place that direction flows from when Arabic/RTL
 * (deferred in FEATURES.md) is switched on: read the user's language from
 * localStorage / the account profile, derive `dir` and `lang`, and apply both
 * to `<html>` on first paint (like lib/appearance.ts does for accent/density).
 *
 * Arabic (`ar`) and Hebrew (`he`) are RTL. Everything else is LTR.
 */

export const RTL_LOCALES = new Set(['ar', 'he', 'fa', 'ur'])

export function isRtl(locale?: string | null): boolean {
  if (!locale) return false
  return RTL_LOCALES.has(locale.toLowerCase())
}

export function dirFor(locale?: string | null): 'ltr' | 'rtl' {
  return isRtl(locale) ? 'rtl' : 'ltr'
}

export const DIRECTION_KEY = 'reely:direction'

export function readDirection(): 'ltr' | 'rtl' | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(DIRECTION_KEY)
    if (raw === 'ltr' || raw === 'rtl') return raw
  } catch {
    // Storage blocked: fall through to locale-derived direction.
  }
  return null
}

export function writeDirection(dir: 'ltr' | 'rtl'): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(DIRECTION_KEY, dir)
  } catch {
    // Storage blocked: nothing to persist.
  }
  document.documentElement.dir = dir
}
