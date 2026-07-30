import '@/styles/globals.css'

import type { Metadata, Viewport } from 'next'
import { CSPostHogProvider } from '@/providers/posthog-provider'
import { QueryProvider } from '@/providers/query-provider'
import { ToastProvider } from '@/providers/toast-provider'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { siteConfig } from '@/config/site'
import { IMAGE_CACHE_HOST_URL } from '@/lib/constants'
import { fontSans } from '@/lib/fonts'
import {
  JsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from '@/lib/structured-data'
import { cn } from '@/lib/utils'
import { Footer } from '@/components/layouts/footer'
import { SiteHeader } from '@/components/layouts/site-header'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'

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

  // Static files, not the app/icon.tsx + app/apple-icon.tsx metadata routes
  // those used to be. Rendering the mark through Satori on the Worker cost
  // real CPU on every cold request for artwork that never changes — the same
  // trade that already made the OG image static (see build-og-image.mjs).
  // All of these come out of `pnpm icons:build`.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '64x64', type: 'image/x-icon' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },

  openGraph: {
    type: siteConfig.openGraph.type as 'website',
    locale: siteConfig.openGraph.locale,
    alternateLocale: siteConfig.seo.alternateLocales,
    siteName: siteConfig.openGraph.siteName,
    title: `${siteConfig.name} — Movie & TV Show Tracker`,
    description: siteConfig.description,
    url: siteConfig.websiteURL,
    ttl: siteConfig.openGraph.ttl,
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Reely — Watch movies & TV shows free. Discover, track, and stream.',
        type: 'image/png',
      },
    ],
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
  },

  appLinks: {
    web: [
      {
        url: siteConfig.websiteURL,
        should_fallback: true,
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
        {/*
          Preconnect to the host that actually serves the LCP hero image. With
          on-the-fly optimization that's the image cache (ImageKit), not TMDB
          origin — warming the TLS+DNS handshake to it is what lets the backdrop
          download on the very first network tick. TMDB origin stays as a cheap
          dns-prefetch since it's only the last-resort fallback in the chain.
        */}
        {IMAGE_CACHE_HOST_URL ? (
          <link rel="preconnect" href={IMAGE_CACHE_HOST_URL} crossOrigin="" />
        ) : (
          <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="" />
        )}
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
        <link
          rel="mask-icon"
          href="/safari-pinned-tab.svg"
          color={siteConfig.theme.colors.dark}
        />
        <meta name="google-adsense-account" content="ca-pub-3842960431278714"></meta>
        <JsonLd data={websiteJsonLd} />
        <JsonLd data={organizationJsonLd} />
      </head>
      <body
        // Browser extensions (Grammarly, password managers, translators) inject
        // attributes/nodes into <body> BEFORE React hydrates, which otherwise
        // trips a hydration mismatch (React #418) on the body element. This is
        // the single biggest source of unactionable #418 noise in our error
        // tracking — the mismatch is caused by the extension, not our markup.
        suppressHydrationWarning
        className={cn(
          'bg-background min-h-screen scroll-smooth font-sans antialiased',
          fontSans.variable
        )}
      >
        {/* Fancy animated aurora backdrop; sits behind everything, content
            above. Two drifting star layers add moving sparkle over the glow. */}
        <div
          aria-hidden="true"
          className="site-aurora pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        >
          <span className="aurora-stars aurora-stars--1" />
          <span className="aurora-stars aurora-stars--2" />
        </div>
        {/* Keyboard/screen-reader skip link — first focusable element, visually
            hidden until focused, jumps past the header nav straight to content. */}
        <a
          href="#main-content"
          className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/70"
        >
          Skip to content
        </a>
        <div className="flex flex-col">
          <SiteHeader />
          <div className="h-full flex-1 overflow-x-hidden">
            <NuqsAdapter>
              <QueryProvider>
                {/* Single page-level <main> landmark. Inner error/not-found/filter
                    subtrees render inside this, so they use <div>, not <main>. */}
                <CSPostHogProvider>
                  <main id="main-content">{children}</main>
                </CSPostHogProvider>
              </QueryProvider>
            </NuqsAdapter>
            <ToastProvider />
            <Footer />
            {modal && modal}
            <ServiceWorkerRegister />
            <InstallPrompt />
          </div>
        </div>
      </body>
    </html>
  )
}
