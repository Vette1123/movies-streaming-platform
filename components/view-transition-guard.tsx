'use client'

import { useEffect } from 'react'

import { installViewTransitionAbortGuard } from '@/lib/view-transition'

/**
 * Installs the view-transition abort guard, once, for the whole app.
 *
 * Renders nothing, and mounts once in the root layout next to the other
 * side-effect components. It runs at hydration, which is before any
 * navigation — and a navigation is where a transition gets skipped, because
 * that is what a second navigation does to the first one.
 *
 * See lib/view-transition.ts for what a skipped transition costs when nobody
 * catches it.
 */
export function ViewTransitionGuard() {
  useEffect(() => {
    installViewTransitionAbortGuard()
  }, [])

  return null
}
