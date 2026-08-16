import { Metadata } from 'next'
import Link from 'next/link'
import {
  BellRing,
  CalendarDays,
  Check,
  Heart,
  ListMusic,
  Mail,
  MessageSquare,
  Palette,
  RefreshCw,
  Server,
  Sparkles,
} from 'lucide-react'

import { siteConfig } from '@/config/site'
import {
  SUPPORT_EMAIL,
  SUPPORT_LIFETIME,
  SUPPORT_MEMBERSHIP,
  SUPPORT_PRICES,
  SUPPORT_URL,
  supportMailto,
} from '@/config/support'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PlanView } from '@/components/support/plan-view'

export const metadata: Metadata = {
  title: 'Support Reely',
  description: `Reely is free and stays free. Supporting it keeps your library on every device, unlocks lists, alerts and more, and pays for the running costs.`,
  alternates: { canonical: '/support' },
  openGraph: {
    title: `Support ${siteConfig.name}`,
    description:
      'Free stays free. Support keeps your library everywhere and pays the bills.',
    url: '/support',
  },
}

/**
 * The support page.
 *
 * Its job is to be honest first and persuasive second, because the product it is
 * asking money for is one somebody is already using for nothing. So the free
 * plan is stated as a promise near the top, the prices are printed rather than
 * hidden behind a click, and every claim below maps to something that actually
 * ships.
 */

const UNLOCKS = [
  {
    Icon: RefreshCw,
    title: 'Your library on every device',
    body: 'Saved titles, watch history and every episode you have ticked off, kept in step across your phone, your laptop and the browser on the TV. A new device signs in and finds everything already there.',
  },
  {
    Icon: CalendarDays,
    title: 'Your watchlist, in your real calendar',
    body: 'Every dated episode and release day on one page — and a private link Google Calendar, Apple Calendar or Outlook subscribes to once, with a reminder the morning before each one. Save a show tonight and next season’s premiere appears in your calendar months from now, on its own, next to your actual life.',
  },
  {
    Icon: Server,
    title: 'Backup servers when a stream will not start',
    body: 'Streams come from a third party, and third parties have bad days. Supporters get every backup server Reely has: one tap to switch, an automatic hop the moment one stops responding, and Reely remembers which server worked for which title so the same title never stalls twice.',
  },
  {
    Icon: ListMusic,
    title: 'Lists worth sharing',
    body: 'Build collections out of your own library, put a note and a score on anything worth one, then publish a list as a real link that unfurls with poster art wherever you paste it.',
  },
  {
    Icon: BellRing,
    title: 'Alerts when it actually airs',
    body: 'A notification the day a new episode of something on your watchlist is out, and the day a film you saved reaches its release date.',
  },
  {
    Icon: Sparkles,
    title: 'Your year in Reely',
    body: 'Hours watched, titles finished, the genres you keep coming back to, your longest streak. Built from what you already track, on a card worth screenshotting.',
  },
  {
    Icon: Palette,
    title: 'Six accents and a denser layout',
    body: 'Small, and the thing you will see every session. It follows your account, so every device you sign in on looks the same.',
  },
  {
    Icon: MessageSquare,
    title: 'A direct line',
    body: `Write to ${SUPPORT_EMAIL} about anything — a billing problem, a bug, or a feature you think should exist. It reaches one person and I answer it myself. Supporters are a short list, so this is a real promise rather than a nice sentence.`,
  },
] as const

// The prices, and what each is worth against the others. Derived rather than
// typed: the yearly saving is a fact about two numbers in config/support.ts, and
// a hand-written "save $10" is how a price change turns into a lie.
const YEARLY_SAVING = SUPPORT_PRICES.monthly * 12 - SUPPORT_PRICES.yearly
const LIFETIME_YEARS = Math.round(
  SUPPORT_PRICES.lifetime / SUPPORT_PRICES.yearly
)

const PLANS: {
  name: string
  price: number
  note: string
  badge?: string
}[] = [
  {
    name: 'Monthly',
    price: SUPPORT_PRICES.monthly,
    note: 'Stop whenever you like',
  },
  {
    name: 'Yearly',
    price: SUPPORT_PRICES.yearly,
    note: 'Two months cheaper than paying monthly',
    badge: `Save $${YEARLY_SAVING}`,
  },
  {
    name: 'Lifetime',
    price: SUPPORT_PRICES.lifetime,
    note: `Paid once. Cheaper than yearly after ${LIFETIME_YEARS} years, and it covers everything I build`,
    badge: 'Best value',
  },
]

/**
 * Where the money goes, in the order it is spent.
 *
 * Printed because the honest version converts better than the vague one: a
 * stranger deciding whether $5 is worth it can see that the site has real bills
 * and that none of them are a salary.
 */
const COSTS = [
  {
    title: 'The bills this has to cover',
    body: 'The domain, the image and data traffic, the error and analytics tooling, and the paid tiers this site will hit if it keeps growing. Reely runs on free plans today and is engineered hard to stay inside them — that engineering is the reason there are no ads.',
  },
  {
    title: 'The part that is not money',
    body: 'Everything here is built by one person in evenings. Support is what makes that time defensible against the rest of life, and it is the only reason a feature request from a supporter turns into a shipped feature rather than a maybe.',
  },
  {
    title: 'What it will never pay for',
    body: 'Ads, trackers sold to anyone, a paywall around anything that is free today, or a feature removed from the free plan to make the paid one look better.',
  },
] as const

const FAQ = [
  {
    q: 'Do I have to pay to use Reely?',
    a: 'No, and you never will. The catalogue, search, filters, the player, the watchlist, watch history and episode tracking are free for everyone with no account. Support adds to that; it does not unlock it.',
  },
  {
    q: 'What happens the moment I pay?',
    a: 'Buy Me a Coffee tells Reely which email address paid, usually within a minute. Sign in with that address and everything is already on. If you paid before signing in, it is waiting for the first time you do.',
  },
  {
    q: 'I paid with a different email than I sign in with.',
    a: `Email me at ${SUPPORT_EMAIL} with the address you sign in with and I will move it the same day. Nothing links a Google account to a payment address on its own, so this one needs a human.`,
  },
  {
    q: 'I paid and nothing switched on. Now what?',
    a: `Email ${SUPPORT_EMAIL} and say which address you paid with. It is almost always the two-addresses problem above, it takes me a minute to fix, and you are not the one who should be debugging it. There is no ticket system — the mail comes to me.`,
  },
  {
    q: 'A stream would not play. Does support fix that?',
    a: 'Often, yes — and that is the honest answer rather than a promise. Streams come from third-party servers Reely does not run. Everyone gets the main one; supporters get the backups, a one-tap switch, and an automatic hop when a server stops responding. If none of them carry a title, no plan can conjure it.',
  },
  {
    q: 'Can I cancel?',
    a: 'One click on Buy Me a Coffee, any time. It runs to the end of the period you already paid for. Nothing you saved is deleted when support ends — your library stays in your browser exactly as it does for everyone else.',
  },
  {
    q: 'Is the Lifetime really once?',
    a: `Yes. $${SUPPORT_PRICES.lifetime}, nothing to renew, nothing to cancel. It is also not tied to this site: it switches on supporter status in every project I build, including the ones that do not exist yet.`,
  },
  {
    q: 'Where do my card details go?',
    a: 'To Buy Me a Coffee, who handle the payment. Reely never sees a card number — the only thing that reaches this site is an email address and which level was bought.',
  },
] as const

const FREE_FOREVER = [
  'The whole catalogue, every filter, and search',
  'The player, on everything',
  'Watchlist, watch history and episode tracking, kept in this browser',
  'The installable app, offline shell included',
  'No account required for any of it',
] as const

export default function SupportPage() {
  return (
    <div className="pb-24">
      {/* Everything below is the pitch, and a supporter is shown their own plan
          instead — they came here to change it, not to be sold it again. The
          prerendered HTML is still the full pitch, so crawlers and automated
          reviewers read the complete description of the page. */}
      <PlanView>
        <section className="container grid max-w-(--breakpoint-xl) gap-10 pt-24 pb-16 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16 lg:pt-28">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold tracking-tighter text-balance md:text-5xl lg:text-6xl">
              Reely is free. Support is what keeps it that way.
            </h1>
            <p className="text-muted-foreground max-w-[52ch] text-lg leading-relaxed">
              Everything on this site stays free for everyone. Supporting it
              moves your library off this one browser and unlocks the rest.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ size: 'lg' })}
              >
                <Heart className="mr-2 size-4" />
                Support Reely
              </a>
              <Link
                href="/account"
                className={buttonVariants({ size: 'lg', variant: 'outline' })}
              >
                Your account
              </Link>
            </div>
          </div>

          <div className="border-primary/25 from-primary/10 rounded-lg border bg-gradient-to-br to-transparent p-6 sm:p-8">
            <p className="text-muted-foreground text-sm">Three ways to do it</p>
            <div className="mt-5 space-y-5">
              {PLANS.map(({ name, price, note, badge }, index) => (
                <div
                  key={name}
                  className={cn(
                    'flex items-baseline justify-between gap-4',
                    index > 0 && 'border-t pt-5'
                  )}
                >
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {name}
                      {badge && (
                        <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-xs font-semibold">
                          {badge}
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-sm">{note}</p>
                  </div>
                  <p className="font-mono text-3xl font-semibold tabular-nums">
                    ${price}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
              Handled by Buy Me a Coffee. Reely never sees a card number.
            </p>
          </div>
        </section>

        <section className="container max-w-(--breakpoint-xl) py-16">
          <h2 className="max-w-[20ch] text-3xl font-bold tracking-tight md:text-4xl">
            What support unlocks
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-6">
            {UNLOCKS.map(({ Icon, title, body }, index) => (
              <article
                key={title}
                className={
                  // A rhythm rather than a grid of identical tiles: the two
                  // features that justify the price take half a row each, the
                  // rest sit in thirds underneath. Keep the count at 2 + a
                  // multiple of 3 or the last row is left ragged.
                  index < 2
                    ? 'bg-card/50 rounded-lg border p-6 md:col-span-3'
                    : 'bg-card/50 rounded-lg border p-6 md:col-span-2'
                }
              >
                <Icon className="text-primary size-5" />
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="container max-w-(--breakpoint-xl) py-16">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                What stays free, permanently
              </h2>
              <p className="text-muted-foreground max-w-[52ch] leading-relaxed">
                Not a trial, not a teaser, and not something that quietly
                shrinks later. If you never pay a penny, Reely keeps doing
                everything it does today.
              </p>
            </div>
            <ul className="divide-y">
              {FREE_FOREVER.map((line) => (
                <li key={line} className="flex items-start gap-3 py-3">
                  <Check className="text-primary mt-0.5 size-4 shrink-0" />
                  <span className="text-sm leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="container max-w-(--breakpoint-xl) py-16">
          <h2 className="max-w-[24ch] text-3xl font-bold tracking-tight md:text-4xl">
            Where the money actually goes
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {COSTS.map(({ title, body }) => (
              <article key={title} className="bg-card/50 rounded-lg border p-6">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="container max-w-(--breakpoint-xl) py-16">
          <div className="rounded-lg border p-6 sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight">
              How it reaches your account
            </h2>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">
                  Pick <span className="font-medium">{SUPPORT_MEMBERSHIP}</span>{' '}
                  or <span className="font-medium">{SUPPORT_LIFETIME}</span> on
                  Buy Me a Coffee. Support switches on automatically for the
                  email address you pay with, usually within a minute or two.
                  Sign in to Reely with that same address and it is already
                  there.
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Paid under a different address? Email {SUPPORT_EMAIL} with the
                  one you sign in with and I will move it across the same day.
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">
                  Cancelling is one click on Buy Me a Coffee, and it takes
                  effect at the end of the period you have already paid for.
                  Nothing you saved is deleted when support ends. Your library
                  stays in this browser exactly as it does for everyone else.
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Everything else — a different email address, what the Lifetime
                  covers, where card details go — is answered below.
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
                <Heart className="mr-2 size-4" />
                Support Reely
              </a>
              <span className="text-muted-foreground text-sm">
                ${SUPPORT_PRICES.monthly} a month, ${SUPPORT_PRICES.yearly} a
                year, or ${SUPPORT_PRICES.lifetime} once.
              </span>
            </div>
          </div>
        </section>

        <section className="container max-w-(--breakpoint-xl) py-16">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Questions worth asking first
          </h2>
          <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="space-y-2">
                <dt className="font-semibold">{q}</dt>
                <dd className="text-muted-foreground max-w-[60ch] text-sm leading-relaxed">
                  {a}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ size: 'lg' })}
            >
              <Heart className="mr-2 size-4" />
              Support Reely
            </a>
            <span className="text-muted-foreground text-sm">
              ${SUPPORT_PRICES.monthly} a month, ${SUPPORT_PRICES.yearly} a
              year, or ${SUPPORT_PRICES.lifetime} once. Cancel in one click.
            </span>
          </div>
        </section>

        <ContactSection />
      </PlanView>
    </div>
  )
}

/**
 * The way out of every problem this page can cause.
 *
 * Money changes what a missing contact costs. Everywhere else on Reely a
 * confused visitor closes the tab; here they have already paid, and the failure
 * mode is somebody out of pocket with nowhere to write. So the address is
 * printed in full rather than hidden behind a form — there is no ticket system,
 * no autoresponder, and no queue: it is one person's mailbox, which is the whole
 * promise.
 */
function ContactSection() {
  return (
    <section className="container max-w-(--breakpoint-xl) py-16">
      <div className="border-primary/25 from-primary/5 rounded-lg border bg-gradient-to-br to-transparent p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 space-y-3">
            <h2 className="text-2xl font-bold tracking-tight">
              Something wrong? Write to me directly.
            </h2>
            <p className="text-muted-foreground max-w-[60ch] leading-relaxed">
              A payment that did not switch anything on, a subscription you want
              cancelled or refunded, the wrong email address on the account, a
              bug, or a feature you think Reely should have. It comes straight
              to me and I answer it myself — usually the same day.
            </p>
            <p className="font-mono text-sm">{SUPPORT_EMAIL}</p>
          </div>
          <a
            href={supportMailto('Support')}
            className={buttonVariants({ size: 'lg' })}
          >
            <Mail className="mr-2 size-4" />
            Email me
          </a>
        </div>
      </div>
    </section>
  )
}
