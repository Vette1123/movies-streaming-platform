import '@/styles/globals.css'

import type { Metadata } from 'next'
import { QueryProvider } from '@/providers/query-provider'
import { ToastProvider } from '@/providers/toast-provider'
import { Analytics } from '@vercel/analytics/react'

import { siteConfig } from '@/config/site'
import { fontSans } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { Footer } from '@/components/footer'
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
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-32x32.png',
    apple: '/apple-touch-icon.png',
    hostname: '/browserconfig.xml',
    username: '/site.webmanifest',
  },
  publisher: siteConfig.links.github,
  applicationName: siteConfig.name,
  colorScheme: 'light dark',
  keywords: siteConfig.keywords,
  appLinks: {
    web: [
      {
        url: siteConfig.websiteURL,
      },
    ],
  },
  metadataBase: new URL(siteConfig.websiteURL),
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* <meta
            httpEquiv="Content-Security-Policy"
            content="frame-src 'none';"
          />

          <meta
            httpEquiv="Content-Security-Policy"
            content="frame-src 'self';"
          /> */}

          {/* <meta
            httpEquiv="Content-Security-Policy"
            content="child-src 'none';"
          /> */}
          <meta
            httpEquiv="Content-Security-Policy"
            content="object-src 'none';"
          />
          <meta
            httpEquiv="Content-Security-Policy"
            content="form-action 'self';"
          />
          <meta
            httpEquiv="Content-Security-Policy"
            content="connect-src 'self';"
          />
          <meta
            httpEquiv="Content-Security-Policy"
            content="media-src 'self';"
          />
          <meta
            httpEquiv="Content-Security-Policy"
            content="base-uri 'self';"
          />
          <meta
            httpEquiv="Content-Security-Policy"
            content="manifest-src 'self';"
          />
          <meta
            httpEquiv="Content-Security-Policy"
            content="worker-src 'self';"
          />
        </head>
        <body
          className={cn(
            'min-h-screen scroll-smooth bg-background font-sans antialiased',
            fontSans.variable
          )}
        >
          <div className="flex flex-col">
            <SiteHeader />
            <div className="h-full flex-1 overflow-x-hidden">
              <QueryProvider>{children}</QueryProvider>
              <ToastProvider />
              <Analytics mode="production" />
              <Footer />
            </div>
          </div>
        </body>
      </html>
    </>
  )
}
