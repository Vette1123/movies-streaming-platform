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
const chipVariants = cva(
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full font-semibold leading-none transition-[color,background-color,border-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
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
        new: 'border border-white/20 bg-emerald-400 font-bold uppercase tracking-wide text-emerald-950 shadow-lg ring-1 ring-emerald-300/40 backdrop-blur-md',
        // Positive status (watched, completed) without the uppercase.
        success:
          'border border-white/20 bg-emerald-500/90 text-white shadow-lg ring-1 ring-emerald-300/30 backdrop-blur-md',
        // Adult / restricted.
        danger: 'border border-destructive/40 text-destructive',
      },
      uppercase: {
        true: 'uppercase tracking-wide',
        false: '',
      },
      interactive: {
        // Fancy hover: lift, fill with brand blue, and cast a soft blue glow so
        // the pill clearly "pops" off the page on interaction.
        true: 'cursor-pointer hover:-translate-y-0.5 hover:border-primary hover:bg-primary-fill hover:text-primary-foreground hover:shadow-[0_8px_24px_-6px_rgba(59,130,246,0.6)]',
        false: '',
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
