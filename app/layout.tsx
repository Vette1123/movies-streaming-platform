import '@/styles/globals.css'

import type { Metadata } from 'next'
// import Script from 'next/script'
import { CSPostHogProvider } from '@/providers/posthog-provider'
import { QueryProvider } from '@/providers/query-provider'
import { ToastProvider } from '@/providers/toast-provider'
import { GoogleTagManager } from '@next/third-parties/google'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { siteConfig } from '@/config/site'
import { GOOGLE_GTM_ID } from '@/lib/constants'
import { fontSans } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { Footer } from '@/components/layouts/footer'
import { SiteHeader } from '@/components/layouts/site-header'

const generateOgImageUrl = (title: string, description: string) =>
  `${siteConfig.websiteURL}/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.seo.applicationName,
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

  // Enhanced Open Graph
  openGraph: {
    type: siteConfig.openGraph.type as 'website',
    locale: siteConfig.openGraph.locale,
    alternateLocale: siteConfig.seo.alternateLocales,
    siteName: siteConfig.openGraph.siteName,
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.websiteURL,
    images: [
      {
        url: generateOgImageUrl(siteConfig.name, siteConfig.description),
        width: siteConfig.openGraph.images.default.width,
        height: siteConfig.openGraph.images.default.height,
        alt: siteConfig.openGraph.images.default.alt,
        type: siteConfig.openGraph.images.default.type,
      },
      {
        url: siteConfig.image,
        width: siteConfig.openGraph.images.fallback.width,
        height: siteConfig.openGraph.images.fallback.height,
        alt: siteConfig.name,
        type: siteConfig.openGraph.images.fallback.type,
      },
    ],
    emails: [siteConfig.author.email],
    phoneNumbers: [],
    faxNumbers: [],
    ttl: siteConfig.openGraph.ttl,
  },

  // Enhanced Twitter
  twitter: {
    card: siteConfig.twitter.card as 'summary_large_image',
    site: siteConfig.twitter.site,
    creator: siteConfig.twitter.creator,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [
      {
        url: generateOgImageUrl(siteConfig.name, siteConfig.description),
        alt: siteConfig.openGraph.images.default.alt,
        width: siteConfig.openGraph.images.default.width,
        height: siteConfig.openGraph.images.default.height,
      },
    ],
  },

  // App-specific metadata
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

  // Enhanced app links
  appLinks: {
    web: [
      {
        url: siteConfig.websiteURL,
        should_fallback: true,
      },
    ],
  },

  // Enhanced icons
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
        rel: 'apple-touch-icon-precomposed',
        url: siteConfig.icons.appleTouchIcon,
      },
    ],
  },

  // Enhanced robots
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

  // Verification (add these to your site config if you have them)
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

  // Enhanced metadata base
  metadataBase: new URL(siteConfig.websiteURL),

  // Additional SEO enhancements
  alternates: {
    canonical: siteConfig.websiteURL,
    languages: {
      'en-US': siteConfig.websiteURL,
      'en-GB': siteConfig.websiteURL,
    },
    media: {
      'only screen and (max-width: 600px)': `${siteConfig.websiteURL}/mobile`,
    },
    types: {
      'application/rss+xml': `${siteConfig.websiteURL}/feed.xml`,
    },
  },

  // Category for app stores
  category: siteConfig.seo.category as 'entertainment',

  // Additional meta tags via other
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': siteConfig.pwa.statusBarStyle,
    'format-detection': siteConfig.security.formatDetection,
    'msapplication-TileColor': siteConfig.theme.colors.tile,
    'msapplication-config': siteConfig.icons.browserConfig,
    'theme-color': siteConfig.theme.colors.dark,
    // Rich snippets preparation
    'application-name': siteConfig.seo.applicationName,
    'msapplication-tooltip': siteConfig.description,
    'msapplication-starturl': siteConfig.websiteURL,
    'msapplication-window': 'width=1024;height=768',
    'msapplication-navbutton-color': siteConfig.theme.colors.primary,
    // Security headers
    referrer: siteConfig.seo.referrer,
    'content-security-policy': siteConfig.security.contentSecurityPolicy,
    // Performance hints
    'dns-prefetch': 'true',
  },
}

interface RootLayoutProps {
  children: React.ReactNode
  modal: React.ReactNode
}

export default function RootLayout({ children, modal }: RootLayoutProps) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <body
          className={cn(
            'min-h-screen scroll-smooth bg-background font-sans antialiased',
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
              <GoogleTagManager gtmId={GOOGLE_GTM_ID as string} />
              {/* <GoogleAnalytics gaId={GOOGLE_MEASUREMENT_ID as string} /> */}
              {modal && modal}
            </div>
          </div>
          {/* <div id="container-be6850e2d2f1956aae5617cd0073c730"></div> */}
        </body>
        {/* <Script
          strategy="lazyOnload"
          type="text/javascript"
          src="//pl26666813.profitableratecpm.com/8e/cd/41/8ecd41eb7e7a77406e555f83886e04dc.js"
        />
        <Script
          strategy="lazyOnload"
          data-cfasync="false"
          src="//pl26666864.profitableratecpm.com/be6850e2d2f1956aae5617cd0073c730/invoke.js"
        />
        <Script
          strategy="lazyOnload"
          data-cfasync="false"
          src="//pl26667450.profitableratecpm.com/31/d5/3d/31d53d91907f9b8b1df13ee2306bfcae.js"
        />
        <Script
          strategy="lazyOnload"
          type="text/javascript"
          id="new-script-options"
        >
          {`
            atOptions = {
              'key' : '523b89856227f68d3c91c27fc62af535',
              'format' : 'iframe',
              'height' : 250,
              'width' : 300,
              'params' : {}
            };
          `}
        </Script>
        <Script
          strategy="lazyOnload"
          type="text/javascript"
          src="//www.highperformanceformat.com/523b89856227f68d3c91c27fc62af535/invoke.js"
        /> */}
      </html>
    </>
  )
}
