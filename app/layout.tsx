import '@/styles/globals.css'

import type { Metadata, Viewport } from 'next'
import { CSPostHogProvider } from '@/providers/posthog-provider'
import { QueryProvider } from '@/providers/query-provider'
import { ToastProvider } from '@/providers/toast-provider'
import { GoogleTagManager } from '@next/third-parties/google'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { siteConfig } from '@/config/site'
import { GOOGLE_GTM_ID } from '@/lib/constants'
import { fontSans } from '@/lib/fonts'
import {
  JsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from '@/lib/structured-data'
import { cn } from '@/lib/utils'
import { Footer } from '@/components/layouts/footer'
import { SiteHeader } from '@/components/layouts/site-header'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: siteConfig.theme.colors.light },
    { media: '(prefers-color-scheme: dark)', color: siteConfig.theme.colors.dark },
  ],
  colorScheme: 'dark light',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.websiteURL),
  title: {
    default: `${siteConfig.name} — Movie & TV Show Tracker`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.seo.applicationName,
  manifest: siteConfig.pwa.manifestPath,
  creator: siteConfig.author.name,
  publisher: siteConfig.seo.publisher,
  authors: [
    {
      name: siteConfig.author.name,
      url: siteConfig.author.website,
    },
  ],
  generator: siteConfig.seo.generator,
  keywords: siteConfig.keywords,
  referrer: siteConfig.seo.referrer as 'origin-when-cross-origin',
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },

  openGraph: {
    type: siteConfig.openGraph.type as 'website',
    locale: siteConfig.openGraph.locale,
    alternateLocale: siteConfig.seo.alternateLocales,
    siteName: siteConfig.openGraph.siteName,
    title: `${siteConfig.name} — Movie & TV Show Tracker`,
    description: siteConfig.description,
    url: siteConfig.websiteURL,
    images: [
      {
        url: '/opengraph-image.png',
        width: siteConfig.openGraph.images.default.width,
        height: siteConfig.openGraph.images.default.height,
        alt: siteConfig.openGraph.images.default.alt,
        type: siteConfig.openGraph.images.default.type,
      },
    ],
    ttl: siteConfig.openGraph.ttl,
  },

  twitter: {
    card: siteConfig.twitter.card as 'summary_large_image',
    site: siteConfig.twitter.site,
    creator: siteConfig.twitter.creator,
    title: `${siteConfig.name} — Movie & TV Show Tracker`,
    description: siteConfig.description,
    images: ['/opengraph-image.png'],
  },

  appleWebApp: {
    capable: siteConfig.pwa.capable,
    title: siteConfig.name,
    statusBarStyle: siteConfig.pwa.statusBarStyle as 'black-translucent',
    startupImage: [
      {
        url: siteConfig.pwa.startupImage,
        media:
          '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
      },
    ],
  },

  appLinks: {
    web: [
      {
        url: siteConfig.websiteURL,
        should_fallback: true,
      },
    ],
  },

  icons: {
    icon: [
      { url: siteConfig.icons.favicon, sizes: 'any' },
      { url: siteConfig.icons.favicon16, sizes: '16x16', type: 'image/png' },
      { url: siteConfig.icons.favicon32, sizes: '32x32', type: 'image/png' },
    ],
    shortcut: siteConfig.icons.favicon,
    apple: [
      {
        url: siteConfig.icons.appleTouchIcon,
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: siteConfig.theme.colors.dark,
      },
    ],
  },

  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && {
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      ...(process.env.NEXT_PUBLIC_YANDEX_VERIFICATION && {
        yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
      }),
      ...(process.env.NEXT_PUBLIC_BING_VERIFICATION && {
        other: {
          'msvalidate.01': process.env.NEXT_PUBLIC_BING_VERIFICATION,
        },
      }),
    },
  }),

  alternates: {
    canonical: siteConfig.websiteURL,
    languages: {
      'en-US': siteConfig.websiteURL,
      'x-default': siteConfig.websiteURL,
    },
  },

  category: siteConfig.seo.category as 'entertainment',

  other: {
    'msapplication-TileColor': siteConfig.theme.colors.tile,
    'msapplication-config': siteConfig.icons.browserConfig,
    'apple-mobile-web-app-title': siteConfig.name,
    'application-name': siteConfig.seo.applicationName,
  },
}

interface RootLayoutProps {
  children: React.ReactNode
  modal: React.ReactNode
}

export default function RootLayout({ children, modal }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <meta name="google-adsense-account" content="ca-pub-3842960431278714"></meta>
        <JsonLd data={websiteJsonLd} />
        <JsonLd data={organizationJsonLd} />
      </head>
      <body
        className={cn(
          'bg-background min-h-screen scroll-smooth font-sans antialiased',
          fontSans.variable
        )}
      >
        <div className="flex flex-col">
          <SiteHeader />
          <div className="h-full flex-1 overflow-x-hidden">
            <NuqsAdapter>
              <QueryProvider>
                <CSPostHogProvider>{children}</CSPostHogProvider>
              </QueryProvider>
            </NuqsAdapter>
            <ToastProvider />
            <Footer />
            {GOOGLE_GTM_ID && <GoogleTagManager gtmId={GOOGLE_GTM_ID} />}
            {modal && modal}
          </div>
        </div>
      </body>
    </html>
  )
}
