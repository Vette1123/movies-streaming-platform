import { Metadata } from 'next'
import Link from 'next/link'
import { Check, Mail } from 'lucide-react'

import { siteConfig } from '@/config/site'
import {
  SUPPORT_EMAIL,
  SUPPORT_LIFETIME,
  SUPPORT_MEMBERSHIP,
  SUPPORT_PRICES,
  supportMailto,
  yearlyAnchor,
} from '@/config/support'
import { FLAGSHIP_FEATURES, SUPPORT_FEATURES } from '@/config/support-features'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { PlanView } from '@/components/support/plan-view'
import { SupportCta } from '@/components/support/support-cta'
import { SupporterCount } from '@/components/support/supporter-count'

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
 *
 * Laid out as eight sections that deliberately do NOT share a shape. The page
 * used to be thirteen identical bordered tiles followed by three more identical
 * bordered tiles, which reads as a template rather than as a product: the eye
 * finds no hierarchy, so nothing is emphasised and the flagship feature lands
 * with exactly the weight of the accent colours. Now the three features
 * somebody can understand from the title alone get room and a real screenshot,
 * the other ten are a dense two-column list with no boxes at all, and no two
 * sections below them repeat a layout.
 *
 * Every feature on it comes from config/support-features.ts, which is also what
 * the supporter's own view of this page reads — the two used to be written out
 * separately and had already drifted.
 */

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
  featured?: boolean
}[] = [
  {
    name: 'Monthly',
    price: SUPPORT_PRICES.monthly,
    note: 'Stop whenever you like',
  },
  {
    name: 'Yearly',
    price: SUPPORT_PRICES.yearly,
    note: `${yearlyAnchor()} — two months cheaper than paying monthly`,
    badge: `Save $${YEARLY_SAVING}`,
    featured: true,
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
    a: 'Often, yes — and that is the honest answer rather than a promise. The Reely Player, Reely’s own player, is now where streams start; behind it sit third-party servers Reely does not run. Supporters get one-tap switching between every backup and an automatic hop when one stops responding. If nothing carries a title, no plan can conjure it.',
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
  'Watchlist, history and episode tracking, kept in this browser',
  'The installable app, offline shell included',
  'No account required for any of it',
] as const

/**
 * The mechanics, as the three things that happen in order.
 *
 * Numbered because the order is the content: the most common support mail is
 * from somebody who paid under one address and signed in with another, and it
 * happens precisely because nobody told them the two had to match.
 */
const STEPS = [
  {
    title: 'Pick a level',
    body: `${SUPPORT_MEMBERSHIP} or ${SUPPORT_LIFETIME}, on Buy Me a Coffee. They own the payment, the cycle and the cancellation.`,
  },
  {
    title: 'Sign in with the same address',
    body: 'Support switches on automatically for the email you paid with, usually within a minute or two. Paid under a different one? Email me and I will move it across the same day.',
  },
  {
    title: 'Nothing else to do',
    body: 'Every feature above is on, on every device you sign in on, and Reely never asks you for money again. Cancelling is one click, and it runs to the end of the period you have already paid for.',
  },
] as const

/** Every section shares this measure, so the page has one left edge. */
const SECTION = 'container max-w-(--breakpoint-xl)'

export default function SupportPage() {
  return (
    <div className="pb-24">
      {/* Everything below is the pitch, and a supporter is shown their own plan
          instead — they came here to change it, not to be sold it again. The
          prerendered HTML is still the full pitch, so crawlers and automated
          reviewers read the complete description of the page. */}
      <PlanView>
        <Hero />
        <Flagships />
        <TheRest />
        <FreeForever />
        <WhereTheMoneyGoes />
        <HowItReachesYou />
        <Faq />
        <ContactSection />
      </PlanView>
    </div>
  )
}

/**
 * Asymmetric split: the promise on the left, the three prices on the right.
 *
 * The prices are the hero's visual rather than an image, because the single
 * question somebody arrives with is "how much", and a page that makes them
 * scroll to answer it has already lost the ones who were only mildly inclined.
 */
function Hero() {
  return (
    <section
      className={cn(
        SECTION,
        'grid gap-10 pt-24 pb-16 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16'
      )}
    >
      <div className="space-y-6">
        <h1 className="text-4xl font-bold tracking-tighter text-balance md:text-5xl lg:text-6xl">
          Reely is free. Support is what keeps it that way.
        </h1>
        <p className="text-muted-foreground max-w-[46ch] text-lg leading-relaxed">
          Everything here stays free for everyone. Supporting it moves your
          library off this one browser and unlocks the rest.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <SupportCta note="none" />
          <Link
            href="/account"
            className={buttonVariants({ size: 'lg', variant: 'outline' })}
          >
            Your account
          </Link>
        </div>
        <SupporterCount />
      </div>

      <PlanLadder />
    </section>
  )
}

/**
 * The three levels, as a ladder rather than a row of cards.
 *
 * Stacked so the numbers land in one vertical column and can be compared in a
 * glance, which three side-by-side pricing cards never allow. The yearly is the
 * one lifted, because it is the one actually being recommended.
 */
function PlanLadder() {
  return (
    <div className="border-border/70 bg-card/30 divide-border/70 divide-y rounded-2xl border">
      {PLANS.map(({ name, price, note, badge, featured }) => (
        <div
          key={name}
          className={cn(
            'flex items-start justify-between gap-6 p-6',
            featured && 'from-primary/10 bg-linear-to-r to-transparent'
          )}
        >
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              {name}
              {badge && (
                <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-xs font-semibold">
                  {badge}
                </span>
              )}
            </p>
            <p className="text-muted-foreground mt-1 max-w-[34ch] text-sm leading-relaxed">
              {note}
            </p>
          </div>
          <p className="font-mono text-4xl leading-none font-semibold tabular-nums">
            <span className="text-muted-foreground align-super text-lg">$</span>
            {price}
          </p>
        </div>
      ))}
      <p className="text-muted-foreground p-6 text-xs leading-relaxed">
        Handled by Buy Me a Coffee. Reely never sees a card number.
      </p>
    </div>
  )
}

/**
 * The three features a stranger can understand from the title alone, given the
 * room to be shown instead of listed. The first carries a real screenshot of
 * the app, because "your library, on every screen" is a claim about a thing
 * that has a picture.
 */
function Flagships() {
  const [lead, ...rest] = FLAGSHIP_FEATURES
  return (
    <section className={cn(SECTION, 'py-16')}>
      <h2 className="max-w-[20ch] text-3xl font-bold tracking-tight md:text-4xl">
        What support unlocks
      </h2>

      <div className="mt-10 grid gap-4 lg:grid-cols-5">
        <article className="border-primary/20 from-primary/10 relative overflow-hidden rounded-2xl border bg-linear-to-br to-transparent lg:col-span-3">
          <div className="max-w-[52ch] p-6 sm:p-8">
            <lead.Icon className="text-primary size-7" />
            <h3 className="mt-4 text-2xl font-semibold tracking-tight md:text-3xl">
              {lead.title}
            </h3>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              {lead.body}
            </p>
          </div>
        </article>

        {/* The screenshot belongs to the library feature (first of the rest):
            it is the claim that has a picture. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {rest.map(({ Icon, title, body }, index) => (
            <article
              key={title}
              className="border-border/70 bg-card/40 relative flex flex-col justify-center rounded-2xl border p-6 sm:p-8"
            >
              {index === 0 && (
                <img
                  src="/screenshot-narrow.webp"
                  alt="The Reely homepage on a phone, showing a featured title and a trending row"
                  width={780}
                  height={1688}
                  loading="lazy"
                  decoding="async"
                  className="pointer-events-none absolute -top-16 -right-10 hidden h-auto w-32 rotate-6 rounded-t-xl border shadow-xl lg:block"
                />
              )}
              <Icon className="text-primary size-5" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/**
 * The other ten, with no boxes at all.
 *
 * Ten more bordered cards after the three above is what made the old page read
 * as a template. A two-column list separates them with space and one accent
 * rule, which also lets the eye scan titles vertically instead of bouncing
 * around a grid.
 */
function TheRest() {
  return (
    <section className={cn(SECTION, 'py-16')}>
      <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
        {SUPPORT_FEATURES.map(({ Icon, title, body }) => (
          <article key={title} className="border-primary/30 border-l pl-5">
            <div className="flex items-center gap-2.5">
              <Icon className="text-primary size-4 shrink-0" />
              <h3 className="font-semibold">{title}</h3>
            </div>
            <p className="text-muted-foreground mt-2 max-w-[52ch] text-sm leading-relaxed">
              {body}
            </p>
          </article>
        ))}
      </div>
      <SupportCta className="mt-14" />
    </section>
  )
}

/** A full-width band, so the promise reads as a statement rather than a card. */
function FreeForever() {
  return (
    <section className={cn(SECTION, 'py-16')}>
      <div className="border-border/70 rounded-2xl border border-dashed p-6 sm:p-10">
        <h2 className="max-w-[24ch] text-3xl font-bold tracking-tight md:text-4xl">
          What stays free, permanently
        </h2>
        <p className="text-muted-foreground mt-4 max-w-[62ch] leading-relaxed">
          Not a trial, not a teaser, and not something that quietly shrinks
          later. If you never pay a penny, Reely keeps doing everything it does
          today.
        </p>
        <ul className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {FREE_FOREVER.map((line) => (
            <li key={line} className="flex items-start gap-2.5">
              <Check className="text-primary mt-0.5 size-4 shrink-0" />
              <span className="text-sm leading-relaxed">{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** Asymmetric: one statement on the left, the three answers stacked right. */
function WhereTheMoneyGoes() {
  return (
    <section className={cn(SECTION, 'py-16')}>
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <h2 className="text-3xl font-bold tracking-tight text-balance md:text-4xl">
          Where the money actually goes
        </h2>
        <dl className="divide-border/70 divide-y">
          {COSTS.map(({ title, body }, index) => (
            <div key={title} className={cn('py-5', index === 0 && 'pt-0')}>
              <dt className="font-semibold">{title}</dt>
              <dd className="text-muted-foreground mt-2 max-w-[68ch] text-sm leading-relaxed">
                {body}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function HowItReachesYou() {
  return (
    <section className={cn(SECTION, 'py-16')}>
      <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
        How it reaches your account
      </h2>
      <ol className="border-border/70 mt-10 grid gap-8 border-t pt-8 md:grid-cols-3 md:gap-10">
        {STEPS.map(({ title, body }, index) => (
          <li key={title}>
            <span className="text-primary/40 font-mono text-4xl leading-none font-semibold tabular-nums">
              {index + 1}
            </span>
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {body}
            </p>
          </li>
        ))}
      </ol>
      <SupportCta className="mt-12" />
    </section>
  )
}

function Faq() {
  return (
    <section className={cn(SECTION, 'py-16')}>
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
      <SupportCta className="mt-12" note="cancel" />
    </section>
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
    <section className={cn(SECTION, 'py-16')}>
      <div className="border-primary/25 from-primary/5 rounded-2xl border bg-linear-to-br to-transparent p-6 sm:p-8">
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
