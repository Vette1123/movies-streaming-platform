import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * The single tag/label primitive for the app. Every small pill — genre, rating,
 * certification, language, "NEW", media-type, search facet — is a `Chip` (or is
 * styled with `chipVariants` when it must render as a Link/button). Fixed height
 * per size handles vertical centering, so call sites never hand-roll padding
 * (which is how the old badges drifted into nine different sizes).
 *
 * Keep colour in the `variant`, not at the call site. If a new semantic colour
 * is needed, add a variant here rather than passing `bg-*` overrides.
 */
/**
 * The hover a pill gets when it is clickable: lift, fill with the accent, and
 * cast a soft glow in the same accent.
 *
 * Exported because components/media/filter-sidebar.tsx renders its own toggle
 * rather than a <Chip> and had this exact string copied into it — which is how
 * the glow came to be `rgba(59,130,246,0.6)`, Reely's blue, hard-coded in both.
 * A supporter on ember or rose got an orange pill throwing a blue shadow. The
 * fill beside it was already `--primary-fill`; only the shadow was a literal.
 */
export const CHIP_INTERACTIVE_HOVER =
  'cursor-pointer hover:-translate-y-0.5 hover:border-primary hover:bg-primary-fill hover:text-primary-foreground hover:shadow-[0_8px_24px_-6px_hsl(var(--primary)/0.6)]'

const chipVariants = cva(
  'inline-flex shrink-0 items-center justify-center rounded-full leading-none font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-200 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none',
  {
    variants: {
      size: {
        // Dense contexts: poster overlays, search results, inline meta.
        sm: 'h-5 gap-1 px-2 text-[11px]',
        // Detail rows and hero metadata.
        md: 'h-6 gap-1.5 px-2.5 text-xs',
      },
      variant: {
        // Genres, meta labels. A solid `secondary` slate surface reads as a
        // distinct pill against the near-black page bg — alpha-of-foreground
        // fills sat too close to the background to be legible.
        neutral:
          'border border-white/12 bg-secondary text-secondary-foreground shadow-sm backdrop-blur-sm',
        // Certifications, language codes. Same visible surface, lighter edge so
        // it still reads as the "hollow" sibling of neutral.
        outline:
          'border border-white/15 bg-secondary/85 text-secondary-foreground',
        // Filled brand — active facets, primary emphasis.
        primary:
          'border border-transparent bg-primary-fill text-primary-foreground',
        // IMDb wordmark. Colour is brand-locked, do not theme it.
        imdb: 'bg-[#f5c518] font-bold tracking-wide text-black',
        // TMDB star rating and similar amber-accented scores.
        rating: 'border border-amber-400/25 bg-amber-400/10 text-amber-200',
        // Freshness — glassy emerald, always uppercase.
        new: 'border border-white/20 bg-emerald-400 font-bold tracking-wide text-emerald-950 uppercase shadow-lg ring-1 ring-emerald-300/40 backdrop-blur-md',
        // Positive status (watched, completed) without the uppercase.
        success:
          'border border-white/20 bg-emerald-500/90 text-white shadow-lg ring-1 ring-emerald-300/30 backdrop-blur-md',
        // Adult / restricted.
        danger: 'border border-destructive/40 text-destructive',
      },
      uppercase: {
        true: 'tracking-wide uppercase',
        false: '',
      },
      // Says whether the pill is a control, and how loudly it reacts. Every
      // value except `false` carries `tap-target`, because the thing that
      // makes 24px a requirement is being clickable, not being hovered: `md`
      // is `h-6` — 24px at the default root, but 22.5px for anyone on compact
      // density, which is under WCAG 2.2's floor. See the utility in
      // styles/globals.css for why it is in pixels.
      interactive: {
        // A label. Nothing to hit.
        false: '',
        // The loud one: lift, fill, glow. For a pill that stands alone.
        true: `tap-target ${CHIP_INTERACTIVE_HOVER}`,
        // The quiet one, for dense rows — a genre strip or a filter bar, where
        // nineteen pills lifting under the pointer is noise. This treatment was
        // copy-pasted into genre-page, year-page and the command menu before it
        // lived here.
        subtle:
          'tap-target cursor-pointer hover:border-primary/50 hover:bg-primary/10 hover:text-foreground',
        // Still a control, but it is the one already selected, so it has
        // nowhere to take you. Keeps the target floor, drops the hover.
        current: 'tap-target',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'neutral',
      uppercase: false,
      interactive: false,
    },
  }
)

export interface ChipProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {}

const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  { className, size, variant, uppercase, interactive, ...props },
  ref
) {
  return (
    <span
      ref={ref}
      className={cn(
        chipVariants({ size, variant, uppercase, interactive }),
        className
      )}
      {...props}
    />
  )
})

export { Chip, chipVariants }
