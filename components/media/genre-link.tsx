import React from 'react'
import Link from 'next/link'
import { ChevronRight, Tag } from 'lucide-react'

import { cn } from '@/lib/utils'
import { chipVariants } from '@/components/ui/chip'

interface GenreLinkProps {
  href: string
  name: string
  ariaLabel?: string
  className?: string
}

// The single genre-pill primitive for the whole app: a tag icon, the label, and
// a chevron that slides in on hover, all wrapped in the interactive chip (lift +
// brand-blue fill + soft glow). Anywhere a genre renders as a navigable chip —
// the detail meta row, the GENRES section, the hero — renders this, so the
// treatment stays identical everywhere. Don't inline genre links; use this.
export function GenreLink({ href, name, ariaLabel, className }: GenreLinkProps) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn(
        chipVariants({ variant: 'neutral', interactive: true }),
        // Named group so the icon/chevron react only to THIS chip's hover — a
        // bare `group-hover` would also fire when an ancestor `group` (e.g. the
        // hero slide) is hovered, lighting up every chip at once.
        'group/genre',
        className
      )}
    >
      <Tag className="text-primary size-3 opacity-70 transition-[opacity,color] duration-200 group-hover/genre:text-primary-foreground group-hover/genre:opacity-100" />
      {name}
      <ChevronRight className="text-primary -ml-1.5 h-3.5 w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover/genre:ml-0 group-hover/genre:w-3.5 group-hover/genre:text-primary-foreground group-hover/genre:opacity-100" />
    </Link>
  )
}
