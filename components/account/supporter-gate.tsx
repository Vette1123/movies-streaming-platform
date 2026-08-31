'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'

import { supportPriceLine } from '@/config/support'
import { trackSupportCtaClicked } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

/**
 * What a supporter feature looks like to someone who is not one yet.
 *
 * One component rather than a locked state written three times, and it shows
 * the feature's real name and real benefit rather than a padlock and the word
 * "Pro" — somebody deciding whether to pay $5 should be able to tell exactly
 * what they would get from the panel they are looking at.
 */
export function SupporterGate({
  title,
  children,
  className,
  Icon = Lock,
  cta = 'Support Reely',
  surface = 'account',
}: {
  title: string
  children: React.ReactNode
  className?: string
  /** Where this panel is, for the CTA breakdown. See trackSupportCtaClicked. */
  surface?: string
  /** A padlock reads as "locked" — wrong on a page whose feature works today
   *  and would simply follow you to your other devices if you paid. */
  Icon?: React.ComponentType<{ className?: string }>
  cta?: string
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-border/60 bg-card/40 p-6',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">{title}</h3>
            <div className="max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
              {children}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/support"
              onClick={() => trackSupportCtaClicked({ surface })}
              className={buttonVariants({ size: 'sm', variant: 'default' })}
            >
              {cta}
            </Link>
            <span className="text-xs text-muted-foreground">
              {supportPriceLine()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
