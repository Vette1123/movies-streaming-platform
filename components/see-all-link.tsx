import React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { cn } from '@/lib/utils'

interface SeeAllLinkProps {
  href: string
  /** What the row leads to, for the accessible name: "See all Trending Movies". */
  label?: string
  className?: string
}

/**
 * The one "see everything in this row" affordance, shared by every rail.
 *
 * It exists because the old affordance was a HOVER reveal — invisible on every
 * touch screen the site is actually used from. This is always visible, always
 * tappable, and identical wherever a rail renders, so "see more" never has to
 * be rediscovered per surface. One label everywhere too: two words for one
 * intent, on every row of the site.
 */
export function SeeAllLink({ href, label, className }: SeeAllLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label ? `See all ${label}` : 'See all'}
      className={cn(
        'group/seeall inline-flex shrink-0 items-center gap-1 self-center rounded-full border border-white/10 bg-white/3 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors duration-200 hover:border-cyan-300/40 hover:bg-white/6 hover:text-cyan-200 focus-visible:border-cyan-300/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden',
        className
      )}
    >
      See all
      <ArrowRight
        aria-hidden
        className="size-3.5 transition-transform duration-200 ease-out group-hover/seeall:translate-x-0.5 motion-reduce:transition-none"
      />
    </Link>
  )
}
