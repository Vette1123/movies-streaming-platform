import { Metadata } from 'next'
import Link from 'next/link'
import {
  BellRing,
  Check,
  Heart,
  ListMusic,
  MessageSquare,
  Palette,
  RefreshCw,
  Sparkles,
} from 'lucide-react'

import { siteConfig } from '@/config/site'
import {
  SUPPORT_LIFETIME,
  SUPPORT_MEMBERSHIP,
  SUPPORT_PRICES,
  SUPPORT_URL,
} from '@/config/support'
import { buttonVariants } from '@/components/ui/button'

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
    body: 'My contact goes out in the welcome note. Ask for a feature and I will build it if it can be built. Supporters are a short list, so this is a real promise rather than a nice sentence.',
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
      <section className="container grid max-w-(--breakpoint-xl) gap-10 pt-24 pb-16 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16 lg:pt-28">
        <div className="space-y-6">
          <h1 className="text-4xl font-bold tracking-tighter text-balance md:text-5xl lg:text-6xl">
            Reely is free. Support is what keeps it that way.
          </h1>
          <p className="text-muted-foreground max-w-[52ch] text-lg leading-relaxed">
            Everything on this site stays free for everyone. Supporting it moves
            your library off this one browser and unlocks the rest.
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
          <p className="text-muted-foreground text-sm">Two ways to do it</p>
          <div className="mt-5 space-y-5">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="font-semibold">Monthly</p>
                <p className="text-muted-foreground text-sm">
                  Stop whenever you like
                </p>
              </div>
              <p className="font-mono text-3xl font-semibold tabular-nums">
                ${SUPPORT_PRICES.monthly}
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t pt-5">
              <div>
                <p className="font-semibold">Yearly</p>
                <p className="text-muted-foreground text-sm">
                  Two months cheaper than monthly
                </p>
              </div>
              <p className="font-mono text-3xl font-semibold tabular-nums">
                ${SUPPORT_PRICES.yearly}
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t pt-5">
              <div>
                <p className="font-semibold">Lifetime</p>
                <p className="text-muted-foreground text-sm">
                  Paid once, nothing to cancel
                </p>
              </div>
              <p className="font-mono text-3xl font-semibold tabular-nums">
                ${SUPPORT_PRICES.lifetime}
              </p>
            </div>
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
                // A rhythm rather than six identical tiles: the two features
                // that justify the price get half a row each, the rest sit in
                // thirds underneath.
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
              Not a trial, not a teaser, and not something that quietly shrinks
              later. If you never pay a penny, Reely keeps doing everything it
              does today.
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
        <div className="rounded-lg border p-6 sm:p-8">
          <h2 className="text-2xl font-bold tracking-tight">
            How it reaches your account
          </h2>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-sm leading-relaxed">
                Pick <span className="font-medium">{SUPPORT_MEMBERSHIP}</span>{' '}
                or <span className="font-medium">{SUPPORT_LIFETIME}</span> on
                Buy Me a Coffee. Support switches on automatically for the email
                address you pay with, usually within a minute or two. Sign in to
                Reely with that same address and it is already there.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Paid under a different address? Reply to the welcome note with
                the one you sign in with and I will move it across the same day.
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-sm leading-relaxed">
                Cancelling is one click on Buy Me a Coffee, and it takes effect
                at the end of the period you have already paid for. Nothing you
                saved is deleted when support ends. Your library stays in this
                browser exactly as it does for everyone else.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The Lifetime is paid once. There is nothing to renew and nothing
                to cancel.
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
    </div>
  )
}
