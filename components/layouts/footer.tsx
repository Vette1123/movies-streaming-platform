import React from 'react'
import Link from 'next/link'

import { siteConfig } from '@/config/site'
import { SUPPORT_EMAIL, supportMailto } from '@/config/support'
import { COMPANION_APPS } from '@/lib/apps'
import { cn } from '@/lib/utils'
import { FooterSupportCard } from '@/components/support/footer-support-card'

import { Icons } from '../icons'
import { PlayStoreLink } from '../play-store-link'
import { buttonVariants } from '../ui/button'

const SITE_LINKS = [
  { href: '/start', label: 'What should I watch?' },
  { href: '/lists', label: 'Lists and people' },
  { href: '/people', label: 'Actors and directors' },
  { href: '/support', label: 'Support Reely' },
  { href: '/account', label: 'Account' },
  { href: '/stats', label: 'Your year in Reely' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/disclaimer', label: 'Disclaimer' },
  // A real address rather than a form. Every page carries it, because the person
  // who needs it most — somebody whose payment did not switch anything on — is
  // exactly the person who will not go looking for a contact page.
  { href: supportMailto('Hello'), label: `Email: ${SUPPORT_EMAIL}` },
]

// The stack, as links. A list rather than a sentence: the prose version had to
// invent connective words for every new entry, and one of them had drifted so
// far that the link labelled Cloudflare pointed at vercel.com.
const CREDITS = [
  { href: 'https://nextjs.org/', label: 'Next.js' },
  { href: 'https://tailwindcss.com/', label: 'Tailwind CSS' },
  { href: 'https://www.cloudflare.com/', label: 'Cloudflare' },
  { href: 'https://www.themoviedb.org/', label: 'TMDB' },
  { href: 'https://vidsrc.to/', label: 'VidSrc' },
]

const linkClass =
  'text-foreground/75 hover:text-foreground font-medium transition-colors'

// "A, B and C" — the separator that follows the item at `index`.
function listSeparator(index: number, total: number): string {
  if (index === total - 1) return ''
  if (index === total - 2) return ' and '
  return ', '
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={linkClass}
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
    </Link>
  )
}

export function Footer() {
  const year = new Date().getFullYear()
  // The year hubs are built from the same clock the pages are, so the link is
  // always to a year that exists. Kept out of SITE_LINKS because that list is a
  // module constant and this one depends on when the build ran.
  const siteLinks = [
    { href: `/movies/year/${year}`, label: `Movies by year` },
    { href: `/tv-shows/year/${year}`, label: `TV shows by year` },
    ...SITE_LINKS,
  ]

  return (
    <footer className="site-footer text-muted-foreground border-border/60 mt-8 border-t text-sm">
      <div className="container grid gap-10 py-12 lg:grid-cols-[1.6fr_1fr_1.1fr] lg:gap-12">
        {/* The app named and explained on every page, not only the homepage:
            anyone who lands deep in the catalogue should be able to tell what
            this site is without scrolling back to a poster wall. */}
        <div className="space-y-3">
          <p className="text-foreground text-base font-semibold">
            {siteConfig.name}
          </p>
          <p className="max-w-[52ch] leading-relaxed">
            A free movie and TV guide. Search thousands of titles, keep a
            watchlist, tick off the episodes you have finished, and stream them
            in your browser. Signing in with Google is optional and syncs your
            library across devices.
          </p>
          <p className="max-w-[52ch] leading-relaxed">
            Also from us:{' '}
            {COMPANION_APPS.map((app, index) => (
              <React.Fragment key={app.slug}>
                <PlayStoreLink app={app} />
                {listSeparator(index, COMPANION_APPS.length)}
              </React.Fragment>
            ))}{' '}
            on Google Play.
          </p>
        </div>

        <nav className="space-y-3" aria-label="Site">
          <p className="text-foreground text-xs font-semibold tracking-wide uppercase">
            Site
          </p>
          <ul className="space-y-2">
            {siteLinks.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className={linkClass}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* The support pitch, on every page. The footer link on its own asked
            for nothing and said nothing about what it costs or what it buys,
            which is most of why nobody followed it. A supporter gets the other
            side of the same card — see FooterSupportCard. */}
        <FooterSupportCard />
      </div>

      <div className="border-border/60 border-t">
        <div className="container flex flex-col items-center justify-between gap-4 py-6 text-xs sm:flex-row">
          <p>
            © {year} {siteConfig.name}. Built by{' '}
            <ExternalLink
              href={siteConfig.author.website}
              label={siteConfig.author.name}
            />{' '}
            with{' '}
            {CREDITS.map(({ href, label }, index) => (
              <React.Fragment key={href}>
                <ExternalLink href={href} label={label} />
                {listSeparator(index, CREDITS.length)}
              </React.Fragment>
            ))}
            .
          </p>
          <Link
            target="_blank"
            rel="noreferrer"
            href={siteConfig.links.buyMeACoffee}
            className={cn(
              'text-white',
              buttonVariants({ variant: 'outline', size: 'sm' })
            )}
          >
            <Icons.buyMeACoffee className="mr-2 size-4" />
            Buy me a coffee
          </Link>
        </div>
      </div>
    </footer>
  )
}
