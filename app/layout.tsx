import '@/styles/globals.css'

import type { Metadata } from 'next'
import { CSPostHogProvider } from '@/providers/posthog-provider'
import { QueryProvider } from '@/providers/query-provider'
import { ToastProvider } from '@/providers/toast-provider'
import { GoogleTagManager } from '@next/third-parties/google'
import { Analytics } from '@vercel/analytics/react'

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
              <Analytics mode="production" />
              <Footer />
              <GoogleTagManager gtmId={GOOGLE_GTM_ID as string} />
              {/* <GoogleAnalytics gaId={GOOGLE_MEASUREMENT_ID as string} /> */}
              {modal && modal}
            </div>
          </div>
        </body>
      </html>
    </>
  )
}
