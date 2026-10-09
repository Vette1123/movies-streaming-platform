import { Heart } from 'lucide-react'

import { supportPriceLine } from '@/config/support'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { CheckoutLink } from '@/components/support/checkout-link'

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
  surface = 'support_page',
  hint = true,
}: {
  className?: string
  /** `cancel` adds the reassurance the last ask on the page needs. */
  note?: 'default' | 'cancel' | 'none'
  /** Where on the page, for checkout_started. */
  surface?: string
  /** Off where the layout places `CheckoutHint` itself. */
  hint?: boolean
}) {
  return (
    <div
      className={cn('flex flex-wrap items-start gap-x-4 gap-y-3', className)}
    >
      <CheckoutLink
        surface={surface}
        hint={hint}
        className={buttonVariants({ size: 'lg' })}
      >
        <Heart className="mr-2 size-4" />
        Support Reely
      </CheckoutLink>
      {note !== 'none' && (
        <span className="pt-2.5 text-sm text-muted-foreground">
          {supportPriceLine()}
          {note === 'cancel' && ' Cancel in one click.'}
        </span>
      )}
    </div>
  )
}
