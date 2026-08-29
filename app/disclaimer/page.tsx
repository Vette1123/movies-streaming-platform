import React from 'react'
import { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { DisclaimerContent } from '@/components/disclaimer/disclaimer-content'

const DESCRIPTION = `Legal disclaimer for ${siteConfig.name}: where the film and TV information comes from, who owns the rights to it, and what this site is and is not responsible for.`

export const metadata: Metadata = {
  title: 'Disclaimer',
  description: DESCRIPTION,
  alternates: {
    canonical: '/disclaimer',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: `Disclaimer | ${siteConfig.name}`,
    description: DESCRIPTION,
    url: `${siteConfig.websiteURL}/disclaimer`,
    type: 'article',
    images: '/opengraph-image.png',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Disclaimer | ${siteConfig.name}`,
    description: DESCRIPTION,
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
