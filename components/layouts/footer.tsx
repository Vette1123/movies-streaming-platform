import React from 'react'
import Link from 'next/link'

import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'

import { Icons } from '../icons'
import { buttonVariants } from '../ui/button'

export function Footer() {
  return (
    <footer className="container space-y-4 pb-16 text-sm text-slate-500">
      <div className="flex items-center justify-center">
        <p>
          Coded in{' '}
          <Link
            href="https://code.visualstudio.com/"
            className="font-medium text-slate-300/75"
            target="_blank"
            rel="noopener noreferrer"
          >
            Visual Studio Code
          </Link>{' '}
          by{' '}
          <Link
            href={siteConfig.author.website}
            className="font-medium text-slate-300/75"
            target="_blank"
            rel="noopener noreferrer"
          >
            yours
          </Link>{' '}
          truly. Built with{' '}
          <Link
            href="https://nextjs.org/"
            className="font-medium text-slate-300/75"
            target="_blank"
            rel="noopener noreferrer"
          >
            Next.js
          </Link>{' '}
          and{' '}
          <Link
            href="https://tailwindcss.com/"
            className="font-medium text-slate-300/75"
            target="_blank"
            rel="noopener noreferrer"
          >
            Tailwind CSS
          </Link>
          , deployed with{' '}
          <Link
            href="https://vercel.com/"
            className="font-medium text-slate-300/75"
            target="_blank"
            rel="noopener noreferrer"
          >
            Cloudflare
          </Link>
          , Using{' '}
          <Link
            href="https://vidsrc.to/"
            className="font-medium text-slate-300/75"
            target="_blank"
            rel="noopener noreferrer"
          >
            VidSrc
          </Link>
          .
        </p>
      </div>
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
