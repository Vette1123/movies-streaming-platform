import React from 'react'
import Link from 'next/link'

import { siteConfig } from '@/config/site'
import { COMPANION_APPS } from '@/lib/apps'
import { cn } from '@/lib/utils'

import { Icons } from '../icons'
import { PlayStoreLink } from '../play-store-link'
import { buttonVariants } from '../ui/button'

const SITE_LINKS = [
  { href: '/support', label: 'Support Reely' },
  { href: '/account', label: 'Account' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/disclaimer', label: 'Disclaimer' },
]

// "A, B and C" — the separator that follows the item at `index`.
function listSeparator(index: number, total: number): string {
  if (index === total - 1) return ''
  if (index === total - 2) return ' and '
  return ', '
}

export function Footer() {
  return (
    <footer className="text-muted-foreground container space-y-4 pb-16 text-sm">
      <div className="flex items-center justify-center">
        <p>
          Coded in{' '}
          <Link
            href="https://code.visualstudio.com/"
            className="text-foreground/75 hover:text-foreground font-medium transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Visual Studio Code
          </Link>{' '}
          by{' '}
          <Link
            href={siteConfig.author.website}
            className="text-foreground/75 hover:text-foreground font-medium transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            yours
          </Link>{' '}
          truly. Built with{' '}
          <Link
            href="https://nextjs.org/"
            className="text-foreground/75 hover:text-foreground font-medium transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Next.js
          </Link>{' '}
          and{' '}
          <Link
            href="https://tailwindcss.com/"
            className="text-foreground/75 hover:text-foreground font-medium transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Tailwind CSS
          </Link>
          , deployed with{' '}
          <Link
            href="https://vercel.com/"
            className="text-foreground/75 hover:text-foreground font-medium transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            Cloudflare
          </Link>
          , Using{' '}
          <Link
            href="https://vidsrc.to/"
            className="text-foreground/75 hover:text-foreground font-medium transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            VidSrc
          </Link>
          .
        </p>
      </div>
      <div className="flex items-center justify-center">
        <p>
          Also check out{' '}
          {COMPANION_APPS.map((app, index) => (
            <React.Fragment key={app.slug}>
              <PlayStoreLink app={app} />
              {listSeparator(index, COMPANION_APPS.length)}
            </React.Fragment>
          ))}{' '}
          on Google Play, apps made by us.
        </p>
      </div>
      {/* The site's own pages, which had no link anywhere on it until accounts
          existed: a privacy page nobody can reach is not a privacy page. */}
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
        {SITE_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="text-foreground/75 hover:text-foreground font-medium transition-colors"
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center justify-center">
        <Link
          target="_blank"
          rel="noreferrer"
          href={siteConfig.links.buyMeACoffee}
          className={cn('text-white', buttonVariants({ variant: 'outline' }))}
        >
          <Icons.buyMeACoffee className="mr-2 size-5" />
          Buy me a coffee
        </Link>
      </div>
    </footer>
  )
}
