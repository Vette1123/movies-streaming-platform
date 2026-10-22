'use client'

import React, { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

/**
 * Reveals its children once they scroll into the viewport, using the same
 * rise-in keyframe the rails use on load. Children start at
 * `opacity-0 translate-y-4` and crossfade up on reveal, so the homepage
 * unfolds section by section instead of painting all at once.
 *
 * One IntersectionObserver is shared across every instance on the page, so a
 * homepage with six rails and a continue-watching row pays for a single
 * observer, not seven. Reduced motion keeps the fade, drops the slide.
 */
let observer: IntersectionObserver | null = null
const revealed = new Set<Element>()

const ensureObserver = () => {
  if (observer) return observer
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && !revealed.has(entry.target)) {
          revealed.add(entry.target)
          entry.target.classList.add('revealed')
          observer?.unobserve(entry.target)
        }
      }
    },
    { threshold: 0.1, rootMargin: '0px 0px -10% 0px' }
  )
  return observer
}

interface ScrollRevealProps {
  children: React.ReactNode
  className?: string
  /** Delay before the reveal animation can start, in seconds. */
  delay?: number
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = ensureObserver()
    obs.observe(el)
    return () => obs.unobserve(el)
  }, [])

  const style = delay > 0 ? { animationDelay: `${delay}s` } : undefined

  return (
    <div
      ref={ref}
      className={cn(
        'reveal-base',
        className
      )}
      style={style}
    >
      {children}
    </div>
  )
}
