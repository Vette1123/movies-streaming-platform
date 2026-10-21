import React from 'react'
import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { SUPPORT_EMAIL, supportMailto } from '@/config/support'
import { JsonLd } from '@/lib/structured-data'

// The press page: the asset a journalist, a newsletter writer or a podcaster
// actually needs, in one place, copy-pasteable.
//
// It exists because the alternative is a DM asking for basics - what the site
// is, what it costs, what the numbers are - and a slow answer to a fast
// deadline. Every fact on this page is true without inflation: the site is
// free, the ratings come from free sources, and the catalogue is the number
// the sitemap actually carries.

export const metadata: Metadata = {
  title: 'Press',
  description:
    'Reely is a free movie and TV tracker with Rotten Tomatoes, IMDb and Metacritic scores on every title, a page for every actor and director, and no account to start. Press kit, copy blocks and contact.',
  alternates: { canonical: '/press' },
  openGraph: {
    title: 'Reely — press kit',
    description:
      'A free movie and TV tracker: four rating sources on every title, a page for every actor and director, no account to start.',
    url: `${siteConfig.websiteURL}/press`,
    type: 'website',
    images: [
      { url: '/opengraph-image.png', width: 1200, height: 630, alt: 'Reely' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reely — press kit',
    description:
      'A free movie and TV tracker: four rating sources on every title, a page for every actor and director, no account to start.',
    images: ['/opengraph-image.png'],
  },
}

const COPY = [
  {
    label: 'One line',
    text: 'Reely is a free movie and TV tracker with IMDb, Rotten Tomatoes and Metacritic scores on every title.',
  },
  {
    label: 'Short (50 words)',
    text: 'Reely is a free movie and TV tracker. Every title carries its IMDb, Rotten Tomatoes, Metacritic and TMDB scores, every actor and director has a page of their own, and nothing needs an account — no sign-up wall in front of a rating.',
  },
  {
    label: 'Long (120 words)',
    text: 'Reely is a free movie and TV tracker built for people who decide what to watch from the scores. Every title page carries four of them — IMDb, Rotten Tomatoes, Metacritic and TMDB — with the vote counts, because a rating without a vote count is half a fact. Every actor and director on a title has a page of their own, so the names in the cast are links and not dead ends. The tracker keeps a watchlist, ticks off what you have finished, and syncs it across your devices if you want it to. There is no account to start, and the site runs on free, public data sources, which is why the ratings are there for everyone rather than for subscribers.',
  },
]

const FACTS = [
  [
    'What it is',
    'A movie and TV tracker: search, watchlist, watched tracking, and where to stream.',
  ],
  [
    'What it costs',
    'Nothing. No account is needed to browse, rate or track, and the rating sources are free ones.',
  ],
  [
    'The ratings',
    'IMDb, Rotten Tomatoes, Metacritic and TMDB, on every title, with vote counts.',
  ],
  [
    'The people',
    'A page for every actor and director in the catalogue, with their filmography.',
  ],
  [
    'Where it runs',
    'A static site on Cloudflare, built with Next.js and Tailwind.',
  ],
  [
    'The numbers',
    '16,000+ pages in the sitemap, 4 rating sources, 0 account required to browse.',
  ],
]

const ASSETS = [
  { name: 'Open Graph card (1200×630 PNG)', href: '/opengraph-image.png' },
  { name: 'App icon (512×512 PNG)', href: '/android-chrome-512x512.png' },
  { name: 'App icon (192×192 PNG)', href: '/android-chrome-192x192.png' },
  { name: 'Favicon (ICO)', href: '/favicon.ico' },
]

export default function PressPage() {
  return (
    <main className="container max-w-3xl py-20 lg:py-32">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: siteConfig.name,
          url: siteConfig.websiteURL,
          description:
            'A free movie and TV tracker with four rating sources on every title.',
        }}
      />
      <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">Press</h1>
      <p className="mt-3 max-w-[60ch] leading-relaxed text-muted-foreground">
        Reely is a free movie and TV tracker. Every title page carries its IMDb,
        Rotten Tomatoes, Metacritic and TMDB scores with the vote counts, every
        actor and director has a page of their own, and nothing needs an
        account. Copy below, or get in touch.
      </p>

      <section className="mt-10">
        <h2 className="text-base font-semibold md:text-xl lg:text-2xl">
          The facts
        </h2>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
          {FACTS.map(([term, detail]) => (
            <div key={term} className="contents">
              <dt className="text-sm font-medium text-muted-foreground">
                {term}
              </dt>
              <dd className="text-sm leading-relaxed">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold md:text-xl lg:text-2xl">Copy</h2>
        <div className="mt-3 space-y-4">
          {COPY.map(({ label, text }) => (
            <div
              key={label}
              className="rounded-lg border border-white/10 bg-white/3 p-4"
            >
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {label}
              </p>
              <p className="mt-2 text-sm leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold md:text-xl lg:text-2xl">
          Assets
        </h2>
        <ul className="mt-3 space-y-2">
          {ASSETS.map((asset) => (
            <li key={asset.href}>
              <a
                href={asset.href}
                className="text-sm underline underline-offset-4 hover:text-foreground"
              >
                {asset.name}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold md:text-xl lg:text-2xl">
          Contact
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Press, corrections and takedowns:{' '}
          <a
            href={supportMailto('Press')}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {SUPPORT_EMAIL}
          </a>
          . Copyright and takedown requests use the same address and go to the
          same person.
        </p>
      </section>
    </main>
  )
}
