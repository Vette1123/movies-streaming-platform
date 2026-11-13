import { Metadata } from 'next'
import audience from '@/data/audience.json'
import { Mail } from 'lucide-react'

import { PLACEMENTS, type Offer } from '@/config/offers'
import { siteConfig } from '@/config/site'
import { GITHUB_SPONSORS_URL, PRO_EMAIL, sponsorMailto } from '@/config/support'
import { withSiteSocial } from '@/lib/page-metadata'
import { pageTitle } from '@/lib/seo-title'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { SponsorCard } from '@/components/sponsor-card'

export const metadata: Metadata = withSiteSocial({
  title: pageTitle(`Advertise on ${siteConfig.name}`),
  description:
    'One sponsor card on nearly every page of Reely: the homepage, every film and episode page, and the pages between. One sponsor at a time, booked by the month or paid per order through your affiliate link, with your coupon on the card.',
  alternates: { canonical: '/advertise' },
  openGraph: {
    images: '/opengraph-image.png',
    title: `Advertise on ${siteConfig.name}`,
    description:
      'One sponsor card on nearly every page. One sponsor at a time, your coupon on it.',
    url: '/advertise',
  },
})

/**
 * The page a sponsor is sent to, and the answer to the first three questions
 * every one of them asks: how many people, how the slot works, what it costs.
 *
 * The numbers are data/audience.json, written by `pnpm sponsor:stats --write`
 * from PostHog (humans only, last 30 days). The card in the middle is the real
 * component in preview mode, so the page cannot drift from what ships.
 */

const fmt = (n: number) => n.toLocaleString('en-US')

const PREVIEW: Offer = {
  id: 'preview',
  sponsor: 'Your brand',
  headline: 'Your headline, in one line',
  body: 'A sentence on what you do for somebody choosing what to watch tonight. Your link carries your referral id, so every order it brings is credited to Reely.',
  cta: 'Your button',
  href: '#contact',
  weight: 0,
  placements: PLACEMENTS,
  coupon: { code: 'REELY', saving: '10% off' },
}

const AUDIENCE: { label: string; value: string }[] = [
  { label: 'People', value: fmt(audience.people) },
  { label: 'Visits', value: fmt(audience.sessions) },
  { label: 'Page views', value: fmt(audience.pageviews) },
  {
    label: 'Plays',
    value: `${fmt(audience.plays)}, by ${fmt(audience.viewers)} people`,
  },
  { label: 'Top countries', value: audience.topCountries.join(', ') },
]

const HOW_IT_WORKS: { label: string; value: string }[] = [
  {
    label: 'Where',
    value:
      'Under the hero on the homepage and on every film and episode page, right below the player, and above the footer on the browse, genre, people, list and watchlist pages. Never on top of the video.',
  },
  {
    label: 'Who',
    value:
      'Everyone without a supporter account. Supporters pay to see no card, and they do not.',
  },
  {
    label: 'How often',
    value: `Once per page view: up to ${fmt(audience.pageviews)} a month at today’s traffic. An impression counts only when the card is actually on screen.`,
  },
  {
    label: 'Rotation',
    value:
      'None while you are booked. One sponsor holds the slot for the whole period; nobody shares it.',
  },
  {
    label: 'Period',
    value:
      'Calendar months. The booking starts and ends on its own dates, in code, with no one to remember.',
  },
  {
    label: 'Links',
    value:
      'Your own referral link, marked rel="sponsored", with subid=reely_home, reely_details or reely_page added, so your dashboard tells Reely apart and shows which spot sold.',
  },
]

const BENEFITS = [
  'The whole slot to yourself. There is one card per page, on nearly every page, and while you are booked every one of them is yours.',
  'Seen at the moment of attention: right under the title somebody has just opened, and under the player while they watch.',
  'Your coupon code printed on the card, with a one-tap copy button.',
  'Served by Reely itself: no ad network, no third-party script, nothing for a blocker list to match.',
  'A short report at the end of the month: how often the card was shown and clicked, and how often the code was copied.',
  'A line in the README on GitHub for the length of the booking.',
]

const NEVER = [
  'Popups, redirects, interstitials or anything over the video',
  'Autoplaying audio or video in the card',
  'Tracking pixels or third-party scripts',
  'More than one sponsor at a time',
]

export default function AdvertisePage() {
  return (
    <main className="container max-w-3xl py-20 lg:py-32">
      <h1 className="text-3xl font-bold tracking-tight text-balance lg:text-4xl">
        Put your brand on every page of Reely
      </h1>
      <p className="mt-3 max-w-[60ch] leading-relaxed text-pretty text-muted-foreground">
        Reely is a free movie and TV site. It carries one sponsor card per page:
        on the homepage, on every film and episode page, and on the pages
        between. You can book it by the month, or pay per order through your
        affiliate link with your coupon on the card.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a href={sponsorMailto()} className={buttonVariants()}>
          <Mail aria-hidden className="mr-2 size-4" />
          Email about the slot
        </a>
        <a href="#how" className={buttonVariants({ variant: 'outline' })}>
          How it works
        </a>
      </div>

      <section className="mt-14" aria-labelledby="preview">
        <h2
          id="preview"
          className="text-base font-semibold md:text-xl lg:text-2xl"
        >
          What viewers see
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The real card, with your words in it.
        </p>
        <div className="mt-4">
          <SponsorCard offer={PREVIEW} placement="details" preview />
        </div>
      </section>

      <section className="mt-14" aria-labelledby="audience">
        <h2
          id="audience"
          className="text-base font-semibold md:text-xl lg:text-2xl"
        >
          The audience
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Last {audience.windowDays} days, as of {audience.asOf}. People, not
          bots: crawler and headless traffic is filtered out before counting.
        </p>
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
          {AUDIENCE.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="how" className="mt-14 scroll-mt-24" aria-labelledby="how-h">
        <h2
          id="how-h"
          className="text-base font-semibold md:text-xl lg:text-2xl"
        >
          How the slot works
        </h2>
        <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-[10rem_1fr]">
          {HOW_IT_WORKS.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="text-sm font-medium text-foreground">{label}</dt>
              <dd className="leading-relaxed text-muted-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-14" aria-labelledby="benefits">
        <h2
          id="benefits"
          className="text-base font-semibold md:text-xl lg:text-2xl"
        >
          What you get
        </h2>
        <ul className="mt-4 space-y-3">
          {BENEFITS.map((b) => (
            <li key={b} className="flex gap-3 leading-relaxed">
              <span
                aria-hidden
                className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary"
              />
              <span className="text-muted-foreground">{b}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14" aria-labelledby="terms">
        <h2
          id="terms"
          className="text-base font-semibold md:text-xl lg:text-2xl"
        >
          Two ways to pay
        </h2>
        <div className="mt-4 grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="font-semibold">Per order</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Send your affiliate link and a coupon code. Nothing up front: you
              pay your usual commission on the orders it brings. The slot runs
              for the month we agree on.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Fixed month</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              One flat fee for a calendar month of the slot, quoted by email
              from the numbers above and paid once through{' '}
              <a
                href={GITHUB_SPONSORS_URL}
                className="underline underline-offset-4 hover:text-foreground"
              >
                GitHub Sponsors
              </a>
              . Your link and coupon go on the card all the same.
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Either way, the README line is included.
        </p>
      </section>

      <section className="mt-14" aria-labelledby="never">
        <h2
          id="never"
          className="text-base font-semibold md:text-xl lg:text-2xl"
        >
          What Reely will not run
        </h2>
        <ul className="mt-4 space-y-2 text-muted-foreground">
          {NEVER.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <section
        id="contact"
        className="mt-14 scroll-mt-24 rounded-xl border border-primary/25 bg-linear-to-br from-primary/10 to-transparent p-6"
        aria-labelledby="contact-h"
      >
        <h2 id="contact-h" className="text-lg font-semibold lg:text-xl">
          Book the slot
        </h2>
        <p className="mt-2 max-w-[60ch] leading-relaxed text-muted-foreground">
          Write to{' '}
          <a
            href={sponsorMailto()}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {PRO_EMAIL}
          </a>{' '}
          with your company, the month you want, and whether you would rather
          pay per order or a fixed month. One person reads it and replies,
          usually the same day.
        </p>
        <a
          href={sponsorMailto()}
          className={cn(buttonVariants(), 'mt-5 w-full sm:w-auto')}
        >
          <Mail aria-hidden className="mr-2 size-4" />
          Email about the slot
        </a>
      </section>
    </main>
  )
}
