import { Heart } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * "Supporter", next to somebody's name on a page strangers can open.
 *
 * It is here for the person wearing it, not for the visitor: the pages that
 * carry it — a published list, a profile — only exist because that person pays
 * for the site, and the badge is the one place that fact is visible to anyone
 * else. Deliberately small and unclickable; the pitch below the fold is where
 * the ask lives.
 */
export function SupporterBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'border-primary/30 bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide',
        className
      )}
    >
      <Heart className="size-3 fill-current" />
      Supporter
    </span>
  )
}
