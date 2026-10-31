import { Metadata } from 'next'
import Link from 'next/link'
import { Check, Minus } from 'lucide-react'

import { siteConfig } from '@/config/site'
import { DEFAULT_SHARE_IMAGE } from '@/lib/og/share-image'
import { buttonVariants } from '@/components/ui/button'
import { KodiDownload } from '@/components/support/kodi-download'
import { TvLinkPreview } from '@/components/support/tv-link-preview'

const TITLE = `${siteConfig.name} on Kodi`
const DESCRIPTION =
  'Watch on the Reely Player on your TV. A supporter add-on for Kodi 19 or newer, linked with a short code from your phone.'

const ZIP_PATH = '/kodi/plugin.video.reely.zip'
const ZIP_URL = `https://www.reely.space${ZIP_PATH}`

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/kodi' },
  robots: { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${siteConfig.websiteURL}/kodi`,
    type: 'website',
    images: DEFAULT_SHARE_IMAGE,
  },
}

const STEPS = [
  {
    title: 'Allow the add-on',
    body: 'In Kodi, go to Settings > System > Add-ons and turn on Unknown sources.',
  },
  {
    title: 'Download it to the device',
    body: 'On Fire TV, use the Downloader app with the address on this page.',
  },
  {
    title: 'Install it',
    body: 'In Kodi, go to Add-ons > Install from zip file and pick it.',
  },
  {
    title: 'Get your code',
    body: 'Open Reely and choose Link this TV. You will see a short code.',
  },
] as const

const WORKS = [
  'Popular movies and shows, search, seasons and episodes',
  'The Reely Player, full screen',
  'Kodi resumes from where you stopped on that TV',
] as const

const NOT_YET = [
  'Subtitles',
  'Resume and watchlist sync with your account',
  'Automatic updates: install a newer zip by hand',
] as const

export default function KodiPage() {
  return (
    <div className="container max-w-(--breakpoint-lg) space-y-16 py-24 lg:pt-28">
      <section className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="min-w-0 space-y-6">
          <h1 className="text-4xl font-bold tracking-tighter text-balance md:text-5xl">
            {TITLE}
          </h1>
          <p className="max-w-[46ch] text-lg leading-relaxed text-pretty text-muted-foreground">
            {DESCRIPTION}
          </p>
          <div className="space-y-2.5">
            <KodiDownload href={ZIP_PATH} />
            <p className="text-sm wrap-anywhere text-muted-foreground">
              {ZIP_URL}
            </p>
          </div>
        </div>
        <TvLinkPreview />
      </section>

      <section>
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Five steps, then just the remote
        </h2>
        <ol className="mt-8 grid gap-8 border-t border-border/70 pt-8 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(({ title, body }, index) => (
            <li key={title}>
              <Step number={index + 1} title={title}>
                {body}
              </Step>
            </li>
          ))}
          <li>
            <Step number={STEPS.length + 1} title="Enter it on your phone">
              Go to{' '}
              <Link
                href="/link"
                className="text-foreground underline underline-offset-4"
              >
                reely.space/link
              </Link>{' '}
              and sign in with your supporter account. The TV picks it up in a
              few seconds.
            </Step>
          </li>
        </ol>
      </section>

      <section className="grid gap-10 sm:grid-cols-2 lg:gap-16">
        <FactList title="What it does" Icon={Check} items={WORKS} />
        <FactList title="Not in this version" Icon={Minus} items={NOT_YET} />
      </section>

      <section className="space-y-4 border-t border-border/70 pt-10">
        <h2 className="text-2xl font-bold tracking-tight">Before you start</h2>
        <p className="max-w-[62ch] leading-relaxed text-muted-foreground">
          Kodi 19 or newer works on any platform. On Fire TV it needs Fire OS:
          newer Vega OS sticks cannot install Kodi. Your link lasts 90 days,
          then the TV asks for a new code.
        </p>
        <Link
          href="/support"
          className={buttonVariants({ size: 'lg', variant: 'outline' })}
        >
          See what supporters get
        </Link>
      </section>
    </div>
  )
}

function Step({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <>
      <span className="font-mono text-4xl leading-none font-semibold text-primary/40 tabular-nums">
        {number}
      </span>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </p>
    </>
  )
}

function FactList({
  title,
  Icon,
  items,
}: {
  title: string
  Icon: React.ComponentType<{ className?: string }>
  items: readonly string[]
}) {
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="text-sm leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
