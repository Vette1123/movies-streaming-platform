import React from 'react'
import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { DisclaimerContent } from '@/components/disclaimer/disclaimer-content'

export const metadata: Metadata = {
  title: 'Disclaimer',
  description: `Legal disclaimer for ${siteConfig.name}. Information about content sources, rights, and responsibilities.`,
  alternates: {
    canonical: '/disclaimer',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: `Disclaimer | ${siteConfig.name}`,
    description: `Legal disclaimer for ${siteConfig.name}.`,
    url: `${siteConfig.websiteURL}/disclaimer`,
    type: 'article',
    images: '/opengraph-image.png',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Disclaimer | ${siteConfig.name}`,
    description: `Legal disclaimer for ${siteConfig.name}.`,
    images: '/opengraph-image.png',
  },
}

function Disclaimer() {
  return (
    <div className="container h-full py-20 lg:py-36">
      <DisclaimerContent />
    </div>
  )
}

export default Disclaimer
