import { Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

interface NewBadgeProps {
  label?: string
  className?: string
}

/**
 * Elegant glass "New" badge for freshly released movies / series seasons.
 * Defaults to an absolutely-positioned poster overlay; pass `className` to
 * restyle (e.g. inline within a dropdown option).
 */
export const NewBadge = ({ label = 'New', className }: NewBadgeProps) => {
  return (
    <span
      className={cn(
        'pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full border border-white/20 bg-emerald-500/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-lg ring-1 ring-emerald-300/30 backdrop-blur-md',
        className
      )}
    >
      <Sparkles className="size-3" />
      {label}
    </span>
  )
}
