import type { Metadata } from 'next'

import { siteConfig } from '@/config/site'
import { SITE_CARD } from '@/lib/og/share-image'

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

const canonicalOf = (meta: Metadata) => {
  const canonical = meta.alternates?.canonical
  return typeof canonical === 'string' ? canonical : undefined
}

const plainTitle = (title: Metadata['title']) => {
  if (typeof title === 'string') return title
  if (title && 'absolute' in title) return title.absolute
  return undefined
}

// A page with a canonical but no openGraph of its own inherits the root
// layout's, og:url included: /start unfurled as the homepage. Its own title,
// description and canonical make the openGraph it should have had.
const ownOpenGraph = (meta: Metadata): OpenGraph | undefined => {
  if (meta.openGraph) return meta.openGraph
  if (!canonicalOf(meta)) return undefined
  return {
    title: plainTitle(meta.title),
    description: meta.description ?? undefined,
  }
}

export function withSiteSocial(meta: Metadata): Metadata {
  const og = ownOpenGraph(meta)
  if (!og) return meta
  const images = og.images ?? SITE_CARD
  const twitter = meta.twitter ?? {}
  return {
    ...meta,
    openGraph: {
      type: 'website',
      siteName: siteConfig.openGraph.siteName,
      locale: siteConfig.openGraph.locale,
      url: canonicalOf(meta),
      ...og,
      images,
    } as OpenGraph,
    twitter: {
      card: siteConfig.twitter.card as 'summary_large_image',
      site: siteConfig.twitter.site,
      creator: siteConfig.twitter.creator,
      title: og.title ?? undefined,
      description: og.description ?? undefined,
      // One card, one image: a summary_large_image card reads a single
      // twitter:image, and a detail page's backdrop + poster rendered two.
      images: imageUrls(images).slice(0, 1),
      ...twitter,
    } as Metadata['twitter'],
  }
}
