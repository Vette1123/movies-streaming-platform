import '@/styles/globals.css'

import type { Metadata } from 'next'
import Script from 'next/script'
import { CSPostHogProvider } from '@/providers/posthog-provider'
import { QueryProvider } from '@/providers/query-provider'
import { ToastProvider } from '@/providers/toast-provider'
import { GoogleTagManager } from '@next/third-parties/google'

import { siteConfig } from '@/config/site'
import { GOOGLE_GTM_ID } from '@/lib/constants'
import { fontSans } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { Footer } from '@/components/layouts/footer'
import { SiteHeader } from '@/components/layouts/site-header'

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  appleWebApp: {
    title: siteConfig.name,
  },
  description: siteConfig.description,
  creator: siteConfig.links.github,
  openGraph: {
    locale: siteConfig.openGraph.locale,
    siteName: siteConfig.name,
    url: siteConfig.links.github,
    type: 'website',
    title: siteConfig.name,
    description: siteConfig.description,
    ttl: 604800,
    emails: siteConfig.email,
  },
  twitter: {
    card: 'summary_large_image',
    creator: siteConfig.twitterTag,
    site: siteConfig.twitterTag,
    images: [
      {
        url: siteConfig.image,
        alt: siteConfig.name,
      },
    ],
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-32x32.png',
    apple: '/apple-touch-icon.png',
    hostname: '/browserconfig.xml',
    username: '/site.webmanifest',
  },
  publisher: siteConfig.links.github,
  applicationName: siteConfig.name,
  keywords: siteConfig.keywords,
  appLinks: {
    web: [
      {
        url: siteConfig.websiteURL,
      },
    ],
  },
  metadataBase: new URL(siteConfig.websiteURL),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
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
        <head />
        <body
          className={cn(
            'min-h-screen scroll-smooth bg-background font-sans antialiased',
            fontSans.variable
          )}
        >
          <div className="flex flex-col">
            <SiteHeader />
            <div className="h-full flex-1 overflow-x-hidden">
              <QueryProvider>
                <CSPostHogProvider>{children}</CSPostHogProvider>
              </QueryProvider>
              <ToastProvider />
              <Footer />
              <GoogleTagManager gtmId={GOOGLE_GTM_ID as string} />
              {/* <GoogleAnalytics gaId={GOOGLE_MEASUREMENT_ID as string} /> */}
              {modal && modal}
            </div>
          </div>
          <div id="container-be6850e2d2f1956aae5617cd0073c730"></div>
        </body>
        <Script
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
        />
      </html>
    </>
  )
}
