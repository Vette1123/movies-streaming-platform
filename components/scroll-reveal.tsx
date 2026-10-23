import React from 'react'

import { cn } from '@/lib/utils'

/**
 * Fades its children up as they scroll into the viewport.
 *
 * Pure CSS (`.reveal-base` in styles/globals.css, a scroll-driven animation),
 * so it is a server component with no observer and no hydration dependency.
 * It used to be an IntersectionObserver that held the section at opacity 0
 * until JS ran, which left everything below the hero blank on a slow load.
 * Browsers without scroll-driven animations, and reduced motion, just show the
 * content.
 */
export function ScrollReveal({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('reveal-base', className)}>{children}</div>
}
