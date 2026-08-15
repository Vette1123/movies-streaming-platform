/**
 * The supporter appearance settings, in the one place that writes them.
 *
 * Kept out of the panel that edits them so the root layout can apply them on
 * every page without pulling the whole account UI into every page's bundle. The
 * CSS behind the attributes is in styles/globals.css.
 */

export const ACCENTS = [
  { id: 'default', label: 'Reely blue', swatch: 'hsl(217.2 91.2% 59.8%)' },
  { id: 'ember', label: 'Ember', swatch: 'hsl(24 90% 55%)' },
  { id: 'ocean', label: 'Ocean', swatch: 'hsl(190 85% 48%)' },
  { id: 'forest', label: 'Forest', swatch: 'hsl(152 60% 45%)' },
  { id: 'violet', label: 'Violet', swatch: 'hsl(268 75% 62%)' },
  { id: 'rose', label: 'Rose', swatch: 'hsl(346 80% 58%)' },
] as const

export const DENSITIES = [
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'compact', label: 'Compact' },
] as const

/** The one place the attributes are written, so preview and reload agree. */
export function applyAppearance(accent?: string, density?: string): void {
  const root = document.documentElement
  if (accent && accent !== 'default') root.dataset.accent = accent
  else delete root.dataset.accent

  if (density === 'compact') root.dataset.density = 'compact'
  else delete root.dataset.density
}

/**
 * The same thing again, as a string, for a blocking <script> in <head>.
 *
 * It has to run before the first paint or a supporter sees the default palette
 * flash to theirs on every navigation, and nothing React renders can be that
 * early. It reads the profile cache written by lib/account.ts — the same cache
 * the header paints the avatar from — so it costs no request and no round trip.
 *
 * Deliberately duplicates `applyAppearance` rather than importing it: this
 * string is inlined into the HTML of every page, so it is written to be as small
 * as it can be, and anything it referenced would have to be inlined too.
 */
export const APPEARANCE_BOOT_SCRIPT = `try{var p=JSON.parse(localStorage.getItem('reely_profile')||'null');if(p&&p.pro){var d=document.documentElement.dataset;if(p.accent&&p.accent!=='default')d.accent=p.accent;if(p.density==='compact')d.density='compact'}}catch(e){}`
