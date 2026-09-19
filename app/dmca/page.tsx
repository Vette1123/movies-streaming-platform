import React from 'react'
import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { DmcaContent } from '@/components/disclaimer/dmca-content'

const DESCRIPTION = `How to report copyrighted material on ${siteConfig.name}, what happens after a report arrives, and how long it takes.`

export const metadata: Metadata = {
  title: 'Copyright & takedown requests',
  description: DESCRIPTION,
  alternates: {
    canonical: '/dmca',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: `Copyright & takedown requests | ${siteConfig.name}`,
    description: DESCRIPTION,
    url: `${siteConfig.websiteURL}/dmca`,
    type: 'article',
    images: '/opengraph-image.png',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Copyright & takedown requests | ${siteConfig.name}`,
    description: DESCRIPTION,
    images: '/opengraph-image.png',
  },
}

function Dmca() {
  return (
    <div className="container h-full py-20 lg:py-36">
      <DmcaContent />
    </div>
  )
}

export default Dmca
