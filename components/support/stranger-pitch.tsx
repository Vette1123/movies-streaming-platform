import Link from 'next/link'
import { Heart } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { SupportLink } from '@/components/support/support-link'

/**
 * What Reely is, for somebody who has never heard of it.
 *
 * The two pages a stranger reaches without looking for the site — a published
 * list and a public profile — both end with this. Somebody sent them a link;
 * they are looking at another person's taste in films on a site they do not
 * know. Telling them what this is, and that the page they are reading is what
 * supporting it buys, is worth more here than anywhere else on the site.
 *
 * One component rather than two nearly identical blocks: the copy below is the
 * pitch, and a pitch that drifts between the two surfaces is two pitches.
 */
export function StrangerPitch({
  surface,
  heading,
  cta,
}: {
  surface: string
  heading: string
  cta: string
}) {
  return (
    <section className="border-primary/25 from-primary/10 mt-16 rounded-lg border bg-gradient-to-br to-transparent p-6 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-[52ch] space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            A movie and TV guide: search thousands of titles, keep a watchlist,
            tick off the episodes you finish, and stream them in your browser.
            No account needed for any of it. Pages like this one are what
            supporters get on top.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Link href="/" className={buttonVariants()}>
            Browse Reely
          </Link>
          <SupportLink
            surface={surface}
            className={buttonVariants({ variant: 'outline' })}
          >
            <Heart className="mr-2 size-4" />
            {cta}
          </SupportLink>
        </div>
      </div>
    </section>
  )
}
