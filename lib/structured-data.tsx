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

/**
 * The site described as an application rather than as a document.
 *
 * `WebSite` says "a site called Reely exists here"; nothing in it says what the
 * software does or that it is free. Google's OAuth brand review checks that the
 * homepage names the app and explains its purpose, and `WebApplication` is the
 * one vocabulary that states both in machine-readable form, next to the visible
 * h1 that says the same thing to a person.
 */
export const webApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  '@id': `${SITE_URL}#webapp`,
  name: siteConfig.name,
  url: SITE_URL,
  applicationCategory: 'EntertainmentApplication',
  operatingSystem: 'Any',
  browserRequirements: 'Requires JavaScript. Requires HTML5.',
  description:
    'Reely is a movie and TV discovery app. Search thousands of films and series, keep a watchlist, track the episodes you have watched, and stream titles in the browser. Signing in with Google is optional and syncs that library across devices.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  publisher: {
    '@type': 'Organization',
    '@id': `${SITE_URL}#organization`,
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

/**
 * People, as schema.org wants them.
 *
 * Names only, with no `@id` and no URL: a cast list is the one place where a
 * wrong identifier is worse than a missing one, and TMDB person ids are not
 * stable enough across merges to publish as identity claims. The names are what
 * make the entity graph connect "who is in this" to the title.
 */
const personList = (names?: (string | null | undefined)[] | null) => {
  const clean = (names ?? []).filter((name): name is string => Boolean(name))
  if (!clean.length) return undefined
  return clean.map((name) => ({ '@type': 'Person', name }))
}

interface TrailerInput {
  key?: string | null
  publishedAt?: string | null
  title: string
}

/**
 * The trailer, as a nested VideoObject.
 *
 * Nested under the title's `trailer` property rather than emitted as a second
 * top-level script: it IS the title's trailer, and one graph beats two
 * unrelated ones. Everything here comes from the `videos` block the detail
 * fetch already carries via `append_to_response`, so a video rich result costs
 * zero extra TMDB requests.
 *
 * `uploadDate` is the clip's real `published_at`, not the title's release date.
 * Google requires the field, and answering it with a date that is often years
 * off is how structured data earns a manual action. No date, no VideoObject.
 */
const trailerObject = ({ key, publishedAt, title }: TrailerInput) => {
  if (!key || !publishedAt) return undefined
  return {
    '@type': 'VideoObject',
    name: `${title} — official trailer`,
    description: `The official trailer for ${title}.`,
    // YouTube's own still, so the thumbnail is a frame of THIS video rather
    // than the title's backdrop. Always present for a live video id.
    thumbnailUrl: `https://i.ytimg.com/vi/${key}/hqdefault.jpg`,
    uploadDate: publishedAt,
    embedUrl: `https://www.youtube.com/embed/${key}`,
    url: `https://www.youtube.com/watch?v=${key}`,
  }
}

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
  cast?: (string | null | undefined)[]
  directors?: (string | null | undefined)[]
  trailerKey?: string | null
  trailerPublishedAt?: string | null
}

// schema.org AggregateRating from a TMDB vote average/count, or undefined when
// there aren't enough votes to publish one. Identical between Movie and TVSeries
// so it lives in one place.
function aggregateRating(
  voteAverage?: number | null,
  voteCount?: number | null
) {
  if (typeof voteAverage !== 'number' || !voteCount) return undefined
  return {
    '@type': 'AggregateRating',
    ratingValue: voteAverage.toFixed(1),
    bestRating: '10',
    worstRating: '0',
    ratingCount: voteCount,
  }
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
  const rating = aggregateRating(movie.voteAverage, movie.voteCount)
  if (rating) schema.aggregateRating = rating
  const actors = personList(movie.cast)
  if (actors) schema.actor = actors
  const directors = personList(movie.directors)
  if (directors) schema.director = directors
  const trailer = trailerObject({
    key: movie.trailerKey,
    publishedAt: movie.trailerPublishedAt,
    title: movie.title,
  })
  if (trailer) schema.trailer = trailer

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
  cast?: (string | null | undefined)[]
  creators?: (string | null | undefined)[]
  trailerKey?: string | null
  trailerPublishedAt?: string | null
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
  const rating = aggregateRating(series.voteAverage, series.voteCount)
  if (rating) schema.aggregateRating = rating
  const actors = personList(series.cast)
  if (actors) schema.actor = actors
  const creators = personList(series.creators)
  if (creators) schema.creator = creators
  const trailer = trailerObject({
    key: series.trailerKey,
    publishedAt: series.trailerPublishedAt,
    title: series.name,
  })
  if (trailer) schema.trailer = trailer

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

export interface ListEntry {
  id: number | string
  name: string
  path: string
  image?: string | null
}

/**
 * The titles a list page is showing, in the order it is showing them.
 *
 * `CollectionPage` already says "this page is a list of things"; it does not
 * say what is in it. `ItemList` does, and it is what a carousel result is built
 * from. Capped at ITEM_LIST_MAX because this is bytes in every prerendered
 * list page's HTML for a diminishing return — the first screen is what a
 * carousel would ever show.
 */
const ITEM_LIST_MAX = 20

export const itemListJsonLd = (
  entries: ListEntry[],
  { name, url }: { name: string; url: string }
) => ({
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name,
  url: url.startsWith('http') ? url : `${SITE_URL}${url}`,
  numberOfItems: Math.min(entries.length, ITEM_LIST_MAX),
  itemListElement: entries.slice(0, ITEM_LIST_MAX).map((entry, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: `${SITE_URL}${entry.path}`,
    name: entry.name,
    ...(entry.image ? { image: entry.image } : {}),
  })),
})

interface PersonSchemaInput {
  id: number | string
  name: string
  description?: string | null
  imageUrl?: string | null
  birthday?: string | null
  deathday?: string | null
  birthPlace?: string | null
  knownFor?: string | null
}

/** A cast/crew page. The `sameAs` an id-based entity claim would need is */
/** deliberately absent — see personList above. */
export const personJsonLd = (person: PersonSchemaInput) => {
  const url = `${SITE_URL}/person/${person.id}`
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${url}#person`,
    url,
    name: person.name,
  }
  if (person.description) schema.description = person.description
  if (person.imageUrl) schema.image = person.imageUrl
  if (person.birthday) schema.birthDate = person.birthday
  if (person.deathday) schema.deathDate = person.deathday
  if (person.birthPlace) schema.birthPlace = person.birthPlace
  if (person.knownFor) schema.jobTitle = person.knownFor
  return schema
}

interface JsonLdProps {
  data: unknown
}

export const JsonLd = ({ data }: JsonLdProps) => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
  />
)
