import '@/styles/globals.css'

import type { Metadata, Viewport } from 'next'
import { CSPostHogProvider } from '@/providers/posthog-provider'
import { QueryProvider } from '@/providers/query-provider'
import { ToastProvider } from '@/providers/toast-provider'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { siteConfig } from '@/config/site'
import { APPEARANCE_BOOT_SCRIPT } from '@/lib/appearance'
import { BMC_WIDGET_SCRIPT } from '@/lib/bmc-widget'
import { IMAGE_CACHE_HOST_URL } from '@/lib/constants'
import { fontSans } from '@/lib/fonts'
import {
  JsonLd,
  organizationJsonLd,
  websiteJsonLd,
} from '@/lib/structured-data'
import { cn } from '@/lib/utils'
import { AccountBoot } from '@/components/account/account-boot'
import { IconSprite } from '@/components/icon-sprite'
import { Footer } from '@/components/layouts/footer'
import { SiteHeader } from '@/components/layouts/site-header'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register'
import { APPLE_SPLASH } from '@/app/_icons/apple-splash'

export const viewport: Viewport = {
  themeColor: [
    {
      media: '(prefers-color-scheme: light)',
      color: siteConfig.theme.colors.light,
    },
    {
      media: '(prefers-color-scheme: dark)',
      color: siteConfig.theme.colors.dark,
    },
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
      // The .ico carries 16/32/48/64 — `sizes` has to say so, or a browser
      // picking by size sees a 64 it has to downscale and reaches for the
      // 192 PNG instead, which is the wasteful version of the same choice.
      {
        url: '/favicon.ico',
        sizes: '16x16 32x32 48x48 64x64',
        type: 'image/x-icon',
      },
      {
        url: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
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
}

// The `@modal` parallel slot that used to intercept /disclaimer is gone:
// intercepting routes are unsupported in `output: 'export'` (Next 16 docs,
// "Static Exports → Unsupported Features"). /disclaimer is now an ordinary
// full-page navigation, which is what a hard load or a shared link always did.
export default function RootLayout({ children }: RootLayoutProps) {
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
        {/*
          The hero arms its muted trailer 0.5–1.2s after a slide takes the frame,
          so the YouTube embed's DNS+TLS handshake would otherwise start from
          cold right as the page is busiest. dns-prefetch, deliberately NOT
          preconnect: the trailer is opt-out and defaults off on low-power
          devices, so a full handshake would be spent on nothing for every
          visitor who never sees one. Resolving the name is the cheap half.
        */}
        <link rel="dns-prefetch" href="https://www.youtube-nocookie.com" />
        <link rel="dns-prefetch" href="https://i.ytimg.com" />
        {/*
          No <link rel="mask-icon">. Safari 15 dropped it in favour of the
          manifest icons + favicon, and the safari-pinned-tab.svg it pointed at
          was a potrace of the pre-Reely logo — a monitor-and-play-button glyph
          with no "R" in it. So it did nothing on every current Safari and
          showed the wrong brand on the ones where it still worked.
        */}
        {/*
          iOS launch screens. Safari ignores the manifest's background_color,
          so without these an installed app shows a white rectangle while it
          boots — on a black-backgrounded app that reads as launching the wrong
          thing. Apple offers no way to do it with fewer files: one image per
          device resolution per orientation, picked by media query. The table
          is app/_icons/apple-splash.ts, which is also what renders the files,
          so a tag here can't point at something the build didn't write.
        */}
        {APPLE_SPLASH.map((splash) => (
          <link
            key={splash.file}
            rel="apple-touch-startup-image"
            href={splash.file}
            media={splash.media}
          />
        ))}
        <meta
          name="google-adsense-account"
          content="ca-pub-3842960431278714"
        ></meta>
        {/*
          A supporter's accent, applied before the first paint. It has to be a
          blocking inline script: anything React renders runs after the page has
          already painted in the default palette, which is a visible flash on
          every single navigation. It reads the profile cache in localStorage —
          the same one the header's avatar paints from — so it costs no request,
          and it does nothing at all for everyone else. See lib/appearance.ts.
        */}
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
        {/*
          Buy Me a Coffee's floating tip jar, kept off the critical path.

          The provider's own <script defer src> tag works and used to sit here.
          What replaced it is the same tag, built after `load` in idle time, so
          the vendor bundle, its webfont and its iframe stop competing with the
          first paint. Why it cannot simply be `async`, why faking
          DOMContentLoaded is safe at that point, and why the corner is the left
          one are all in lib/bmc-widget.ts.

          It sells COFFEES, not the membership levels in config/support.ts, so
          nothing bought here grants supporter status — including the panel's
          "make this monthly", which does fire a recurring event but carries no
          level name we configured, and lib/billing/bmc.ts matches on that name
          with `fallback: null`. The path that actually turns somebody into a
          supporter is /support. This is a tip jar, and if a payer ever reports
          buying here and getting nothing switched on, this comment is the why.
        */}
        <script dangerouslySetInnerHTML={{ __html: BMC_WIDGET_SCRIPT }} />
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
          className="focus:bg-primary-fill focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:px-4 focus:py-2 focus:shadow-lg focus:ring-2 focus:ring-white/70 focus:outline-none"
        >
          Skip to content
        </a>
        {/* Defs for the icons that repeat per card — see components/icon-sprite.
            Must be in the document for any <use href="#i-…"> on the page. */}
        <IconSprite />
        {/*
          Sticky footer, three lines of it: the shell is a full-height column,
          the content region is the only part allowed to grow, and the footer is
          its sibling rather than its last child. Without that, a short page
          (sign-in, an empty watchlist, a 404) left the footer wherever the
          content happened to stop, floating in the middle of the viewport.

          min-h-svh, not dvh: svh is the *smallest* viewport height, so the
          footer sits at the bottom edge whether or not mobile browser chrome is
          showing. With dvh it would hide under the address bar until you scroll.
        */}
        <div className="flex min-h-svh flex-col">
          <SiteHeader />
          <div className="flex-1 overflow-x-hidden">
            <NuqsAdapter>
              <QueryProvider>
                {/* Single page-level <main> landmark. Inner error/not-found/filter
                    subtrees render inside this, so they use <div>, not <main>. */}
                <CSPostHogProvider>
                  <main id="main-content">{children}</main>
                </CSPostHogProvider>
              </QueryProvider>
            </NuqsAdapter>
          </div>
          <Footer />
          <ToastProvider />
          <ServiceWorkerRegister />
          <InstallPrompt />
          {/* Renders nothing: library sync + appearance, mounted once. */}
          <AccountBoot />
        </div>
      </body>
    </html>
  )
}
