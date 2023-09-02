import '@/styles/globals.css'

import type { Metadata } from 'next'
import { QueryProvider } from '@/providers/query-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import { ToastProvider } from '@/providers/toast-provider'

import { siteConfig } from '@/config/site'
import { fontSans } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body
          className={cn(
            'bg-background min-h-screen font-sans antialiased',
            fontSans.variable
          )}
        >
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <div className="flex min-h-screen flex-col">
              <SiteHeader />
              <div className="h-full flex-1">
                <QueryProvider>{children}</QueryProvider>
                <ToastProvider />
              </div>
            </div>
          </ThemeProvider>
        </body>
      </html>
    </>
  )
}
