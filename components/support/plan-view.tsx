'use client'

import Link from 'next/link'
import { ArrowUpRight, Check, Heart } from 'lucide-react'

import {
  SUPPORT_EMAIL,
  SUPPORT_PRICES,
  SUPPORT_URL,
  supportMailto,
} from '@/config/support'
import { useAccountIdentity } from '@/hooks/use-account'
import { buttonVariants } from '@/components/ui/button'

/**
 * The support page, minus the sales pitch, for someone who already bought.
 *
 * A supporter reaching this page is not deciding whether to pay — they are
 * checking what they are on, or changing it. Reading four sections of "here is
 * why you should support Reely" to find a link to their own membership is the
 * kind of thing that makes people cancel.
 *
 * Plan CHANGES all happen on Buy Me a Coffee: it owns the payment method, the
 * cycle and the cancellation, and there is no API here that could move someone
 * from monthly to yearly. So this panel's whole job is to say what they have
 * and hand them the one link that can change it.
 */
function SupporterPanel() {
  return (
    // The same top padding the pitch below uses. The header is sticky and sits
    // over the top of the page, so a plain py-16 puts this card's border under
    // it — which the pitch never showed, because it was the only branch anybody
    // checked.
    <section className="container max-w-(--breakpoint-xl) pt-24 pb-16 lg:pt-28">
      <div className="border-primary/25 from-primary/10 rounded-lg border bg-gradient-to-br to-transparent p-6 sm:p-8">
        <p className="text-primary inline-flex items-center gap-2 text-sm font-semibold">
          <Heart className="size-4" />
          You are a supporter
        </p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Everything is already switched on.
        </h2>
        <p className="text-muted-foreground mt-3 max-w-[60ch] leading-relaxed">
          Your library syncs across every device, your queue knows which episode
          you are up to, your ratings are yours to keep, suggestions read your
          history, Letterboxd and IMDb imports are open, every backup server is
          available, lists are shareable, alerts are running, your watchlist has
          a calendar feed with reminders, your year comes as a card, and the
          themes are yours. Thank you — this is what keeps Reely online and free
          for everyone else.
        </p>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="font-semibold">Change your plan</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Switching from monthly to yearly saves two months, and the
              Lifetime is ${SUPPORT_PRICES.lifetime} once and never renews. Both
              are one change on Buy Me a Coffee, which handles the billing.
            </p>
            <ul className="text-muted-foreground space-y-2 text-sm">
              {[
                `Monthly — $${SUPPORT_PRICES.monthly} a month, cancel whenever`,
                `Yearly — $${SUPPORT_PRICES.yearly} a year, two months cheaper`,
                `Lifetime — $${SUPPORT_PRICES.lifetime} once, covers every project I build`,
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="text-primary mt-0.5 size-4 shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Anything else</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Cancelling is one click there too, and it takes effect at the end
              of the period you have already paid for. Nothing you saved is
              deleted when support ends.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Paid under a different address than the one you sign in with, or
              anything else gone wrong? Email{' '}
              <a
                href={supportMailto('Supporter question')}
                className="text-foreground underline underline-offset-4"
              >
                {SUPPORT_EMAIL}
              </a>{' '}
              and I will sort it the same day.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ size: 'lg' })}
          >
            Manage or change plan
            <ArrowUpRight className="ml-2 size-4" />
          </a>
          <Link
            href="/account"
            className={buttonVariants({ size: 'lg', variant: 'outline' })}
          >
            Your account
          </Link>
        </div>
      </div>
    </section>
  )
}

/**
 * The pitch, or the panel above.
 *
 * `ready` is false during the prerender and on the first client pass, and the
 * pitch is what renders then — deliberately. The static HTML this page ships
 * with is the full description of what support buys, which is what crawlers and
 * automated reviewers read; the swap happens only once the browser knows who is
 * looking.
 */
export function PlanView({ children }: { children: React.ReactNode }) {
  const { ready, pro } = useAccountIdentity()
  if (!ready || !pro) return <>{children}</>
  return <SupporterPanel />
}
