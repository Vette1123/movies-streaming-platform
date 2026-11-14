'use client'

import { AlertTriangle } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useReelyUp } from '@/hooks/use-reely-up'

/**
 * Said next to every benefit that needs the Reely Player, while its relay is
 * down (/api/stream/health). The support page is static, so this is the one
 * live piece of it: nobody should pay for the player in a week it cannot play,
 * and a supporter checking what they have should read the truth.
 *
 * Nothing at all while it is up, so the static page is unchanged for the
 * normal case and there is no layout shift unless there is news.
 */
export function PlayerDownNote({ className }: { className?: string }) {
  const up = useReelyUp()
  if (up) return null
  return (
    <p
      role="status"
      className={cn(
        'inline-flex max-w-full items-start gap-1.5 rounded-xl bg-amber-950/60 px-3 py-1.5 text-xs leading-relaxed font-medium text-amber-200 ring-1 ring-amber-400/30',
        className
      )}
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        Temporarily unavailable. Titles play on the regular servers until it is
        back.
      </span>
    </p>
  )
}
