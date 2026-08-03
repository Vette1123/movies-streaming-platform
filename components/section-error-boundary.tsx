'use client'

import React from 'react'
import { RefreshCw, RotateCcw, TriangleAlert } from 'lucide-react'

import { isStaleBundleError, reloadForStaleDeploy } from '@/lib/client-errors'
import { loadPostHog } from '@/lib/posthog-client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Why this exists: app/error.tsx is the nearest boundary for the entire route,
// so any client subtree that threw — one poster rail, the filter sidebar, the
// episode list — replaced the WHOLE page with "Something went wrong". A single
// lazy chunk that failed to load took down content that had already rendered
// fine. Wrapping each independently-failing island in its own boundary keeps the
// blast radius to that island: the rest of the page stays usable.
//
// Note this only catches CLIENT render/lifecycle errors in its subtree, which is
// exactly the class we care about (chunk loads, hydration, client-side data).
// Server-render failures are still handled by app/error.tsx and Suspense.

interface SectionErrorBoundaryProps {
  children: React.ReactNode
  // Identifies the island in PostHog so a recurring failure is attributable to
  // one section instead of a generic route-level error.
  section: string
  // Shown in place of the island. Keep it short — this sits inline in the page,
  // not on a full-height error screen.
  title?: string
  className?: string
}

interface SectionErrorBoundaryState {
  error: Error | null
}

const STALE_TITLE = 'Updating to the latest version'
const STALE_BODY = 'This part of the page came from an older build. Refreshing…'

export class SectionErrorBoundary extends React.Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  state: SectionErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // A bundle left behind by a deploy is not a fault in this section — recover
    // the user onto the fresh one instead of reporting it. reloadForStaleDeploy
    // is rate-limited (1 per 15s, 2 per session), so a subtree that keeps
    // throwing can't put the tab in a refresh loop; it just keeps the fallback.
    if (isStaleBundleError(error)) {
      reloadForStaleDeploy()
      return
    }

    // Forces the posthog module in rather than queueing (see app/error.tsx) —
    // a section that just blew up is exactly when the report matters most.
    void loadPostHog().then((posthog) =>
      posthog?.captureException(error, {
        error_boundary: 'SectionErrorBoundary',
        error_section: this.props.section,
        component_stack: info.componentStack,
      })
    )
  }

  private retry = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const stale = isStaleBundleError(error)
    const Icon = stale ? RefreshCw : TriangleAlert

    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          // A section that failed is a status strip, not a modal: full-bleed to
          // the column it replaced, left-aligned, with a coloured rail carrying
          // the state. A small centred card floating in a wide empty row reads
          // like a crash; this reads like the page telling you something.
          'relative isolate my-6 flex w-full items-start gap-4 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 backdrop-blur-sm sm:items-center sm:px-5',
          this.props.className
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-0 left-0 w-[3px]',
            stale ? 'bg-cyan-300/70' : 'bg-amber-400/70'
          )}
        />
        <span
          aria-hidden
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg border',
            stale
              ? 'border-cyan-300/25 bg-cyan-300/10 text-cyan-300'
              : 'border-amber-400/25 bg-amber-400/10 text-amber-400'
          )}
        >
          <Icon
            className={cn(
              'size-4',
              stale &&
                'animate-spin [animation-duration:2.4s] motion-reduce:animate-none'
            )}
          />
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-foreground text-sm leading-snug font-medium">
            {stale
              ? STALE_TITLE
              : (this.props.title ?? "This section didn't load")}
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
            {stale ? STALE_BODY : 'Everything else on the page still works.'}
          </p>
        </div>

        {!stale && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={this.retry}
            className="shrink-0 gap-2 rounded-full border-white/15 bg-white/5 hover:bg-white/10"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            Retry
          </Button>
        )}
      </div>
    )
  }
}
