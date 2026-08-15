'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'

import { SUPPORT_PRICES } from '@/config/support'
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
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-border/60 bg-card/40 rounded-lg border border-dashed p-6',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Lock className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">{title}</h3>
            <div className="text-muted-foreground max-w-[60ch] text-sm leading-relaxed">
              {children}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/support"
              className={buttonVariants({ size: 'sm', variant: 'default' })}
            >
              Support Reely
            </Link>
            <span className="text-muted-foreground text-xs">
              ${SUPPORT_PRICES.monthly} a month, ${SUPPORT_PRICES.yearly} a
              year, or ${SUPPORT_PRICES.lifetime} once.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
