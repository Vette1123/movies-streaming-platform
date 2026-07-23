import { Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Chip } from '@/components/ui/chip'

interface NewBadgeProps {
  label?: string
  className?: string
}

/**
 * Glass "New" badge for freshly released movies / series seasons. Visual comes
 * from the shared `new` chip variant (one size everywhere); `className` only
 * controls placement — default is an absolutely-positioned poster overlay, pass
 * `static` / `relative` to inline it.
 */
export const NewBadge = ({ label = 'New', className }: NewBadgeProps) => {
  return (
    <Chip
      variant="new"
      size="sm"
      className={cn(
        'pointer-events-none absolute left-2 top-2 z-10',
        className
      )}
    >
      <Sparkles className="size-3" aria-hidden />
      {label}
    </Chip>
  )
}
