// An SVG sprite for the handful of icons that repeat once per card.
//
// lucide-react renders a full <svg> per usage — ~230 bytes of boilerplate
// attributes plus the path data — and the homepage draws 27 stars, 24 play
// triangles, 10 chevrons and 7 tags. That was 34KB of the page's 45KB of inline
// SVG, the same four shapes over and over. Here each shape is emitted ONCE, in
// the layout, and every instance becomes `<svg><use href="#i-star"/></svg>`.
//
// Only icons that repeat per item belong here. A one-off icon is cheaper as a
// plain lucide component than as a symbol nobody reuses — keep importing those
// from lucide-react as usual.
//
// Paint lives on the symbol, not the instance, so it isn't re-serialized 27
// times. That splits the icons into two groups: `star` and `play` are always
// rendered solid (their call sites used `fill-current`), while `tag` and
// `chevron-right` are stroked outlines. Both resolve `currentColor` against the
// <use> element, so text-colour utilities on the instance still drive them.
const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

const SOLID = {
  fill: 'currentColor',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinejoin: 'round',
} as const

export const SPRITE_ICONS = ['star', 'play', 'tag', 'chevron-right'] as const
export type SpriteIconName = (typeof SPRITE_ICONS)[number]

/**
 * Renders the sprite definitions. Mount ONCE, in the root layout — `<use>`
 * resolves against the current document, so every SpriteIcon on the page (server
 * or client) points at these. Hidden without `display: none`, which Safari has
 * historically treated as a reason to skip rendering referenced content.
 */
export function IconSprite() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={0}
      height={0}
      className="absolute h-0 w-0 overflow-hidden"
    >
      <symbol id="i-star" viewBox="0 0 24 24" {...SOLID}>
        <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
      </symbol>
      <symbol id="i-play" viewBox="0 0 24 24" {...SOLID}>
        <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
      </symbol>
      <symbol id="i-tag" viewBox="0 0 24 24" {...STROKE}>
        <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
        <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
      </symbol>
      <symbol id="i-chevron-right" viewBox="0 0 24 24" {...STROKE}>
        <path d="m9 18 6-6-6-6" />
      </symbol>
    </svg>
  )
}

/**
 * One instance of a sprite icon. Decorative by default (`aria-hidden`), same as
 * how these icons were used through lucide — pass a label only if the icon is
 * the sole content of a control.
 */
export function SpriteIcon({
  name,
  className,
  label,
}: {
  name: SpriteIconName
  className?: string
  label?: string
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable="false"
    >
      <use href={`#i-${name}`} />
    </svg>
  )
}
