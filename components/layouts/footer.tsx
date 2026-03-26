import React from 'react'
import Link from 'next/link'

import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'
import { Icons } from '@/components/icons'
import { buttonVariants } from '@/components/ui/button'

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Movies', href: '/movies' },
  { label: 'TV Shows', href: '/tv-shows' },
  { label: 'Search', href: '/search' },
  { label: 'Watchlist', href: '/watchlist' },
  { label: 'Watch History', href: '/watch-history' },
  { label: 'Disclaimer', href: '/disclaimer' },
]

const SOCIAL_LINKS = [
  { label: 'GitHub', href: siteConfig.links.github, icon: 'gitHub' },
  { label: 'Twitter', href: siteConfig.links.twitter, icon: 'twitter' },
  { label: 'Portfolio', href: siteConfig.author.website, icon: 'portfolio' },
] as const

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-black/40 backdrop-blur-sm">
      <div className="container max-w-(--breakpoint-2xl) py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Icons.reelLogo className="size-6" />
              <span className="text-lg font-bold">{siteConfig.name}</span>
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">
              {siteConfig.description}
            </p>
            <div className="flex gap-2 pt-1">
              {SOCIAL_LINKS.map(({ label, href, icon }) => {
                const Icon = Icons[icon]
                return (
                  <Link
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={cn(
                      buttonVariants({ size: 'icon', variant: 'ghost' }),
                      'size-8'
                    )}
                  >
                    <Icon className="size-4 fill-current" />
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Browse
            </p>
            <ul className="space-y-2">
              {NAV_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm text-muted-foreground transition-colors hover:text-white"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Support
            </p>
            <p className="text-sm text-muted-foreground">
              Enjoying the app? Help keep it running.
            </p>
            <Link
              href={siteConfig.links.buyMeACoffee}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'w-fit text-white'
              )}
            >
              <Icons.buyMeACoffee className="mr-2 size-4" />
              Buy me a coffee
            </Link>
            <p className="mt-2 text-xs text-muted-foreground">
              Movie data provided by{' '}
              <Link
                href="https://www.themoviedb.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-white"
              >
                TMDB
              </Link>
              . Streaming via{' '}
              <Link
                href="https://vidsrc.to/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-white"
              >
                VidSrc
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {siteConfig.name}. Built with{' '}
            <Link
              href="https://nextjs.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              Next.js
            </Link>{' '}
            &amp;{' '}
            <Link
              href="https://tailwindcss.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              Tailwind CSS
            </Link>
            .
          </p>
          <p className="text-xs text-muted-foreground">
            Made by{' '}
            <Link
              href={siteConfig.author.website}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-white"
            >
              {siteConfig.author.name}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  )
}
