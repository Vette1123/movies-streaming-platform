import { Heart } from 'lucide-react'

import { SUPPORT_URL, supportPriceLine } from '@/config/support'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

/**
 * The button that takes the money, and the line of prices beside it.
 *
 * The support page asks four times, in four places, because the decision is
 * made at four different depths — and it was four hand-written copies of the
 * same markup. One component, one price string, both built from config.
 */
export function SupportCta({
  className,
  note = 'default',
}: {
  className?: string
  /** `cancel` adds the reassurance the last ask on the page needs. */
  note?: 'default' | 'cancel' | 'none'
}) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-3', className)}
    >
      <a
        href={SUPPORT_URL}
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ size: 'lg' })}
      >
        <Heart className="mr-2 size-4" />
        Support Reely
      </a>
      {note !== 'none' && (
        <span className="text-muted-foreground text-sm">
          {supportPriceLine()}
          {note === 'cancel' && ' Cancel in one click.'}
        </span>
      )}
    </div>
  )
}
