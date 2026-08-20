'use client'

import Link from 'next/link'
import { ArrowUpRight, Check, Heart } from 'lucide-react'

import {
  SUPPORT_EMAIL,
  SUPPORT_PRICES,
  SUPPORT_URL,
  supportMailto,
} from '@/config/support'
import { ALL_SUPPORT_FEATURES } from '@/config/support-features'
import { useAccountIdentity } from '@/hooks/use-account'
import { buttonVariants } from '@/components/ui/button'

/** Every level, priced from config so this list cannot outlive a price change. */
const LEVELS = [
  {
    name: 'Monthly',
    price: SUPPORT_PRICES.monthly,
    note: 'cancel whenever you like',
  },
  {
    name: 'Yearly',
    price: SUPPORT_PRICES.yearly,
    note: 'two months cheaper than monthly',
  },
  {
    name: 'Lifetime',
    price: SUPPORT_PRICES.lifetime,
    note: 'paid once, covers every project I build',
  },
] as const

/**
 * The support page, minus the sales pitch, for someone who already bought.
 *
 * A supporter reaching this page is not deciding whether to pay — they are
 * checking what they are on, or changing it. Reading four sections of "here is
 * why you should support Reely" to find a link to their own membership is the
 * kind of thing that makes people cancel.
 *
 * It DOES still list every feature, in full, because the second question after
 * "what am I on" is "what did that actually buy me" — and a supporter who
 * cannot answer it is a supporter who cancels at renewal. The list is the same
 * config/support-features.ts the pitch reads. It used to be one hand-written
 * run-on sentence here that named nine of the thirteen features, so the person
 * who had paid was reading a worse description than the stranger who had not.
 *
 * Plan CHANGES all happen on Buy Me a Coffee: it owns the payment method, the
 * cycle and the cancellation, and there is no API here that could move someone
 * from monthly to yearly. So the panel's other job is to hand them that link.
 */
function SupporterPanel({ name }: { name: string | null }) {
  return (
    // The same top padding the pitch below uses. The header is sticky and sits
    // over the top of the page, so a plain py-16 puts this card's border under
    // it — which the pitch never showed, because it was the only branch anybody
    // checked.
    <div className="container max-w-(--breakpoint-xl) pt-24 pb-16 lg:pt-28">
      <section className="border-primary/25 from-primary/10 rounded-2xl border bg-linear-to-br to-transparent p-6 sm:p-8">
        <p className="text-primary inline-flex items-center gap-2 text-sm font-semibold">
          <Heart className="size-4" />
          You are a supporter
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          {name ? `Thank you, ${name}.` : 'Thank you.'} Everything is switched
          on.
        </h1>
        <p className="text-muted-foreground mt-3 max-w-[62ch] leading-relaxed">
          This is what keeps Reely online, ad-free, and free for everyone who
          never pays a penny. Every one of the features below is live on your
          account, on every device you sign in on.
        </p>

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
      </section>

      {/* The receipt: every feature, ticked. Two columns of plain rows rather
          than thirteen cards — this is a checklist being scanned, not a pitch
          being read, so the titles need to line up vertically. */}
      <section className="mt-16">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          What you have
        </h2>
        <ul className="mt-8 grid gap-x-12 gap-y-5 sm:grid-cols-2">
          {ALL_SUPPORT_FEATURES.map(({ Icon, title, short }) => (
            <li key={title} className="flex items-start gap-3">
              <span className="bg-primary/10 text-primary mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full">
                <Icon className="size-3.5" />
              </span>
              <div className="min-w-0">
                <p className="font-medium">{title}</p>
                <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                  {short}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight">Change your plan</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Switching from monthly to yearly saves two months, and the Lifetime
            is ${SUPPORT_PRICES.lifetime} once and never renews. Both are one
            change on Buy Me a Coffee, which handles the billing.
          </p>
          <ul className="text-muted-foreground space-y-2 text-sm">
            {LEVELS.map(({ name: level, price, note }) => (
              <li key={level} className="flex items-start gap-2">
                <Check className="text-primary mt-0.5 size-4 shrink-0" />
                <span>
                  <span className="text-foreground font-medium">{level}</span> —
                  ${price}, {note}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight">Anything else</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Cancelling is one click there too, and it takes effect at the end of
            the period you have already paid for. Nothing you saved is deleted
            when support ends.
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
      </section>
    </div>
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
  const { ready, pro, name } = useAccountIdentity()
  if (!ready || !pro) return <>{children}</>
  return <SupporterPanel name={name} />
}
