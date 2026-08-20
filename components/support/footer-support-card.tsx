'use client'

import Link from 'next/link'
import { Heart } from 'lucide-react'

import { supportPriceRow } from '@/config/support'
import { cn } from '@/lib/utils'
import { useAccountIdentity } from '@/hooks/use-account'
import { buttonVariants } from '@/components/ui/button'
import { SupportLink } from '@/components/support/support-link'

const CARD =
  'border-primary/25 from-primary/10 space-y-3 rounded-lg border bg-gradient-to-br to-transparent p-5'

/**
 * The support block that sits in the footer of every page.
 *
 * The pitch is the prerendered version, so crawlers and anyone whose account
 * has not answered yet read the full offer. A supporter gets the other card —
 * the support page promises "the moment support lands, Reely stops asking", and
 * a pitch on the bottom of every page they load is exactly the asking it
 * promised to stop. Same box, same size, so nothing moves when the swap
 * happens.
 */
export function FooterSupportCard() {
  const { ready, pro } = useAccountIdentity()

  if (ready && pro) {
    return (
      <div className={CARD}>
        <p className="text-foreground flex items-center gap-2 text-base font-semibold">
          <Heart className="text-primary size-4" />
          You support Reely
        </p>
        <p className="leading-relaxed">
          Every supporter feature is on, on every device you sign in on. This is
          what keeps the site online, free of ads, and free for everyone who
          never pays a penny. Thank you.
        </p>
        <Link
          href="/account"
          className={cn(
            buttonVariants({ size: 'sm', variant: 'outline' }),
            'w-full sm:w-auto'
          )}
        >
          Your account
        </Link>
      </div>
    )
  }

  return (
    <div className={CARD}>
      <p className="text-foreground text-base font-semibold">
        Reely stays free. Support keeps it that way.
      </p>
      <p className="leading-relaxed">
        Supporters move their library off one browser and unlock a queue that
        knows which episode they are on, their own ratings, suggestions read
        from their history, a Letterboxd and IMDb import, backup streaming
        servers, a calendar feed with reminders, shareable lists, release
        alerts, a year-in-review card and themes. Everything free today stays
        free either way.
      </p>
      <p className="text-foreground/90 font-medium">{supportPriceRow()}</p>
      <SupportLink
        surface="footer"
        className={cn(buttonVariants({ size: 'sm' }), 'w-full sm:w-auto')}
      >
        <Heart className="mr-2 size-4" />
        See what support unlocks
      </SupportLink>
    </div>
  )
}
