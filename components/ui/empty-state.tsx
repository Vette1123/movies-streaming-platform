'use client'

import * as React from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface EmptyStateAction {
  label: string
  icon?: LucideIcon
  // Provide `href` for navigation or `onClick` for in-place actions (e.g.
  // clearing filters, resetting an error boundary) — one of the two.
  href?: string
  onClick?: () => void
}

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  primaryAction?: EmptyStateAction
  secondaryAction?: EmptyStateAction
  className?: string
  /**
   * `h2` by default, because most callers drop this inside a page that already
   * has its own `<h1>` (an empty watchlist under "My Watchlist", a failed rail
   * under "Movies"). On 404 and the error boundary this component IS the page,
   * so those pass `h1` — a document whose top heading is an `h2` has no
   * document title for a screen reader, and it is what an SEO crawl reports as
   * a missing `<h1>`.
   */
  headingLevel?: 'h1' | 'h2'
}

// The stack fades up one element at a time. This was a framer-motion variant
// stagger, which is a heavy way to buy four animation-delays: this component is
// reachable from app/error.tsx, the ROOT error boundary, and Next bundles that
// into every route's client JS — so the library rode along on every page of the
// site (145KB raw / 48KB transferred, measured) to animate a screen almost
// nobody sees. The CSS keyframes are in styles/globals.css, including the
// reduced-motion variant, so nothing here has to wait for hydration to know
// which one to run.
const STAGGER_MS = 80
const STAGGER_DELAY_MS = 40

/** Inline `animation-delay` for the nth element in the entrance sequence. */
const riseDelay = (index: number): React.CSSProperties => ({
  animationDelay: `${STAGGER_DELAY_MS + index * STAGGER_MS}ms`,
})

// A ghost poster echoes the real WatchedItemCard's 2:3 shape, so the empty
// state previews the grid that will eventually fill this space.
const PosterGhost = ({ className }: { className?: string }) => (
  <div
    aria-hidden
    className={cn(
      'from-muted/90 to-muted/20 aspect-2/3 w-16 rounded-lg border border-white/10 bg-linear-to-b shadow-lg sm:w-20',
      className
    )}
  />
)

// One button that renders as a Link (when `href` is set) or a real <button>
// (when `onClick` is set), so callers can navigate or act in place with the
// same styling.
function ActionButton({
  action,
  variant = 'default',
  className,
}: {
  action: EmptyStateAction
  variant?: 'default' | 'ghost'
  className?: string
}) {
  const Icon = action.icon
  const inner = (
    <>
      {Icon && <Icon className="size-4" aria-hidden />}
      {action.label}
    </>
  )

  if (action.href) {
    return (
      <Button asChild size="lg" variant={variant} className={className}>
        <Link href={action.href}>{inner}</Link>
      </Button>
    )
  }

  return (
    <Button
      type="button"
      size="lg"
      variant={variant}
      onClick={action.onClick}
      className={className}
    >
      {inner}
    </Button>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  headingLevel: Heading = 'h2',
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex min-h-[60vh] flex-col items-center justify-center px-6 text-center',
        className
      )}
    >
      {/* Signature: a fanned trio of ghost posters with a floating medallion. */}
      <div
        style={riseDelay(0)}
        className="animate-rise-in relative mb-8 flex items-end justify-center"
      >
        <div
          aria-hidden
          className="bg-primary/20 absolute top-1/2 left-1/2 size-36 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        />
        <PosterGhost className="-mr-6 translate-y-3 -rotate-12 opacity-50" />
        <PosterGhost className="relative z-10 scale-105 opacity-95" />
        <PosterGhost className="-ml-6 translate-y-3 rotate-12 opacity-50" />
        <div className="bg-background/70 ring-primary/20 absolute top-1/2 left-1/2 z-20 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl border border-cyan-300/30 text-cyan-300 shadow-xl ring-1 backdrop-blur-md">
          <Icon className="size-7" aria-hidden />
        </div>
      </div>

      <Heading
        style={riseDelay(1)}
        className="animate-rise-in text-foreground text-xl font-semibold text-balance sm:text-2xl"
      >
        {title}
      </Heading>
      <p
        style={riseDelay(2)}
        className="animate-rise-in text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed text-pretty sm:text-base"
      >
        {description}
      </p>

      {(primaryAction || secondaryAction) && (
        <div
          style={riseDelay(3)}
          className="animate-rise-in mt-7 flex flex-wrap items-center justify-center gap-3"
        >
          {primaryAction && (
            <ActionButton
              action={primaryAction}
              className="gap-2 rounded-full transition hover:scale-105 active:scale-95"
            />
          )}
          {secondaryAction && (
            <ActionButton
              action={secondaryAction}
              variant="ghost"
              className="text-muted-foreground hover:text-foreground gap-2 rounded-full"
            />
          )}
        </div>
      )}
    </div>
  )
}
