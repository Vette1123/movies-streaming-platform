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
        // Glassy neutral — genres, meta labels. Adapts to light/dark via tokens.
        neutral:
          'border border-border/60 bg-muted/50 text-foreground/80 backdrop-blur-sm',
        // Hollow — certifications, language codes.
        outline: 'border border-border/70 text-foreground/80',
        // Filled brand — active facets, primary emphasis.
        primary: 'border border-transparent bg-primary text-primary-foreground',
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
        true: 'cursor-pointer hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/10 hover:text-foreground',
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
  extends React.HTMLAttributes<HTMLSpanElement>,
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
