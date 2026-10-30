import { Metadata } from 'next'
import Link from 'next/link'

import { siteConfig } from '@/config/site'
import { DEFAULT_SHARE_IMAGE } from '@/lib/og/share-image'
import { buttonVariants } from '@/components/ui/button'

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
  'In Kodi, go to Settings > System > Add-ons and turn on Unknown sources.',
  'Download the add-on to the device. On Fire TV, use the Downloader app with the address below.',
  'In Kodi, go to Add-ons > Install from zip file and pick it.',
  'Open Reely and choose Link this TV. You will see a short code.',
] as const

export default function KodiPage() {
  return (
    <section className="container min-h-svh max-w-md py-20 lg:py-28">
      <div className="space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            {TITLE}
          </h1>
          <p className="leading-relaxed text-pretty text-muted-foreground">
            {DESCRIPTION} On Fire TV it needs Fire OS: newer Vega OS sticks
            cannot install Kodi.
          </p>
        </div>

        <ol className="list-decimal space-y-3 pl-5 leading-relaxed">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
          <li>
            On your phone, enter the code at{' '}
            <Link href="/link" className="underline underline-offset-4">
              reely.space/link
            </Link>
            .
          </li>
        </ol>

        <div className="space-y-3">
          <a
            href={ZIP_PATH}
            download
            className={buttonVariants({ size: 'lg', className: 'w-full' })}
          >
            Download the add-on
          </a>
          <p className="text-sm wrap-anywhere text-muted-foreground">
            {ZIP_URL}
          </p>
        </div>
      </div>
    </section>
  )
}
