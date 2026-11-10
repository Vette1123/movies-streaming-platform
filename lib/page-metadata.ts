import type { Metadata } from 'next'

import { siteConfig } from '@/config/site'

type OpenGraph = NonNullable<Metadata['openGraph']>
type OgImages = OpenGraph['images']

const imageUrls = (images: OgImages) =>
  (Array.isArray(images) ? images : [images])
    .filter(Boolean)
    .map((image) =>
      typeof image === 'string' || image instanceof URL
        ? image
        : (image as { url: string | URL }).url
    )

/**
 * A page's metadata with the site-wide social fields filled in.
 *
 * Next does not merge `openGraph` or `twitter` with the root layout's: a page
 * that sets either replaces the whole object. So a page with its own
 * openGraph lost og:site_name, og:locale and og:type, and a page with no
 * twitter block kept the HOME page's twitter title and description. This
 * fills those from the page's own openGraph, leaving anything set explicitly.
 */
/**
 * The RSS feed as a <link rel="alternate">. A page's own `alternates` replaces
 * the root layout's whole object, so the home page has to restate it or the
 * feed is linked from nowhere.
 */
export const feedAlternate = {
  'application/rss+xml': [
    {
      url: `${siteConfig.websiteURL}/rss.xml`,
      title: `${siteConfig.name} — what is trending`,
    },
  ],
}

export function withSiteSocial(meta: Metadata): Metadata {
  const og = meta.openGraph
  if (!og) return meta
  const images = og.images ?? '/opengraph-image.png'
  const twitter = meta.twitter ?? {}
  return {
    ...meta,
    openGraph: {
      type: 'website',
      siteName: siteConfig.openGraph.siteName,
      locale: siteConfig.openGraph.locale,
      ...og,
      images,
    } as OpenGraph,
    twitter: {
      card: siteConfig.twitter.card as 'summary_large_image',
      site: siteConfig.twitter.site,
      title: og.title ?? undefined,
      description: og.description ?? undefined,
      images: imageUrls(images),
      ...twitter,
    } as Metadata['twitter'],
  }
}
