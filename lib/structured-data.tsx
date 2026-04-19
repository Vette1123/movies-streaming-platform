import { siteConfig } from '@/config/site'

const SITE_URL = siteConfig.websiteURL

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}#website`,
  name: siteConfig.name,
  alternateName: siteConfig.seo.applicationName,
  url: SITE_URL,
  description: siteConfig.description,
  inLanguage: 'en-US',
  publisher: {
    '@type': 'Organization',
    '@id': `${SITE_URL}#organization`,
    name: siteConfig.seo.publisher,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_URL}/android-chrome-512x512.png`,
      width: 512,
      height: 512,
    },
  },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/movies?search={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
}

export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}#organization`,
  name: siteConfig.seo.publisher,
  url: SITE_URL,
  logo: `${SITE_URL}/android-chrome-512x512.png`,
  sameAs: [
    siteConfig.links.twitter,
    siteConfig.links.github,
    siteConfig.links.website,
  ],
}

interface BreadcrumbItem {
  name: string
  url: string
}

export const breadcrumbJsonLd = (items: BreadcrumbItem[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
  })),
})

interface MovieSchemaInput {
  id: number | string
  title: string
  description?: string | null
  releaseDate?: string | null
  runtime?: number | null
  genres?: string[]
  imageUrl?: string | null
  voteAverage?: number | null
  voteCount?: number | null
  tagline?: string | null
}

export const movieJsonLd = (movie: MovieSchemaInput) => {
  const url = `${SITE_URL}/movies/${movie.id}`
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    '@id': `${url}#movie`,
    url,
    name: movie.title,
    inLanguage: 'en',
  }

  if (movie.description) schema.description = movie.description
  if (movie.tagline) schema.alternativeHeadline = movie.tagline
  if (movie.releaseDate) schema.datePublished = movie.releaseDate
  if (movie.imageUrl) schema.image = movie.imageUrl
  if (movie.genres?.length) schema.genre = movie.genres
  if (movie.runtime) {
    const hours = Math.floor(movie.runtime / 60)
    const minutes = movie.runtime % 60
    schema.duration = `PT${hours}H${minutes}M`
  }
  if (typeof movie.voteAverage === 'number' && movie.voteCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: movie.voteAverage.toFixed(1),
      bestRating: '10',
      worstRating: '0',
      ratingCount: movie.voteCount,
    }
  }

  return schema
}

interface SeriesSchemaInput {
  id: number | string
  name: string
  description?: string | null
  firstAirDate?: string | null
  lastAirDate?: string | null
  numberOfSeasons?: number | null
  numberOfEpisodes?: number | null
  genres?: string[]
  imageUrl?: string | null
  voteAverage?: number | null
  voteCount?: number | null
  tagline?: string | null
}

export const tvSeriesJsonLd = (series: SeriesSchemaInput) => {
  const url = `${SITE_URL}/tv-shows/${series.id}`
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    '@id': `${url}#tv-series`,
    url,
    name: series.name,
    inLanguage: 'en',
  }

  if (series.description) schema.description = series.description
  if (series.tagline) schema.alternativeHeadline = series.tagline
  if (series.firstAirDate) schema.startDate = series.firstAirDate
  if (series.lastAirDate) schema.endDate = series.lastAirDate
  if (series.imageUrl) schema.image = series.imageUrl
  if (series.genres?.length) schema.genre = series.genres
  if (series.numberOfSeasons) schema.numberOfSeasons = series.numberOfSeasons
  if (series.numberOfEpisodes) schema.numberOfEpisodes = series.numberOfEpisodes
  if (typeof series.voteAverage === 'number' && series.voteCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: series.voteAverage.toFixed(1),
      bestRating: '10',
      worstRating: '0',
      ratingCount: series.voteCount,
    }
  }

  return schema
}

export const collectionPageJsonLd = (input: {
  name: string
  description: string
  url: string
}) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: input.name,
  description: input.description,
  url: input.url,
  isPartOf: {
    '@id': `${SITE_URL}#website`,
  },
})

interface JsonLdProps {
  data: unknown
}

export const JsonLd = ({ data }: JsonLdProps) => (
  <script
    type="application/ld+json"
    // eslint-disable-next-line react/no-danger
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
  />
)
