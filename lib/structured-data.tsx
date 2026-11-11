import { siteConfig } from '@/config/site'
import { SUPPORT_EMAIL } from '@/config/support'
import { aggregateRating, jsonLdText, titleSameAs } from '@/lib/json-ld'
import { mediaDescription } from '@/lib/seo-description'

export { titleSameAs }

const SITE_URL = siteConfig.websiteURL

/**
 * Profiles that ARE Reely (the product's repo, its Product Hunt page), as the
 * Organization's sameAs. The builder's own accounts stay on `founder`.
 */
export const BRAND_PROFILES = [
  'https://github.com/Vette1123/movies-streaming-platform',
  'https://www.producthunt.com/products/reely',
]

export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}#website`,
  name: siteConfig.name,
  // The spellings people search for (Search Console: "reely space" ranks 1,
  // bare "reely" 43). Repeating `name` here told Google nothing.
  alternateName: ['Reely Space', 'reely.space'],
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
  // No SearchAction: Google retired the sitelinks search box in 2024 and
  // crawls a urlTemplate as a literal URL (the sister site's Search Console
  // listed "/?url={search_term_string}" as a page, 2026-11).
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
  sameAs: BRAND_PROFILES,
  // The one inbox a person answers (config/support.ts), so a knowledge panel
  // or an AI answer naming a contact names the real one.
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: SUPPORT_EMAIL,
    url: `${SITE_URL}/support`,
    availableLanguage: ['en'],
  },
  // These profiles are the builder's, not the brand's: as the Organization's
  // sameAs they told Google that Reely IS that person. They identify the founder.
  founder: {
    '@type': 'Person',
    name: siteConfig.author.name,
    url: siteConfig.author.website,
    sameAs: [siteConfig.links.twitter, siteConfig.links.github],
  },
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
  /** The page the trailer belongs to; its `#trailer` is the node's @id. */
  pageUrl: string
  kind: 'movie' | 'series'
  year?: string | null
  genres?: string[]
  overview?: string | null
}

/**
 * The trailer, as a VideoObject.
 *
 * Emitted twice from this one builder: nested under the title's `trailer`
 * property (it IS the title's trailer) and as its own script, because Google's
 * video report reads a VideoObject on the watch page, and a nested one is the
 * easier to miss. Same `@id`, same fields, so the two are one entity. Everything
 * comes from the `videos` block the detail fetch already carries via
 * `append_to_response`: zero extra TMDB requests.
 *
 * `uploadDate` is the clip's real `published_at`, not the title's release date.
 * Google requires the field, and answering it with a date that is often years
 * off is how structured data earns a manual action. No date, no VideoObject.
 * The description is the page's own (lib/seo-description.ts), not a new slice.
 */
const trailerObject = (input: TrailerInput) => {
  const { key, publishedAt, title } = input
  if (!key || !publishedAt) return undefined
  return {
    '@type': 'VideoObject',
    '@id': `${input.pageUrl}#trailer`,
    name: `${title} — Official Trailer`,
    description: mediaDescription({
      title,
      year: input.year ?? undefined,
      kind: input.kind,
      genres: input.genres,
      overview: input.overview,
    }),
    // YouTube's own still, so the thumbnail is a frame of THIS video rather
    // than the title's backdrop. Always present for a live video id.
    thumbnailUrl: `https://i.ytimg.com/vi/${key}/hqdefault.jpg`,
    uploadDate: publishedAt,
    embedUrl: `https://www.youtube.com/embed/${key}`,
    url: `https://www.youtube.com/watch?v=${key}`,
  }
}

const yearOf = (date?: string | null) => date?.slice(0, 4) || undefined

const movieTrailerInput = (movie: MovieSchemaInput): TrailerInput => ({
  key: movie.trailerKey,
  publishedAt: movie.trailerPublishedAt,
  title: movie.title,
  pageUrl: `${SITE_URL}/movies/${movie.id}`,
  kind: 'movie',
  year: yearOf(movie.releaseDate),
  genres: movie.genres,
  overview: movie.description,
})

const seriesTrailerInput = (series: SeriesSchemaInput): TrailerInput => ({
  key: series.trailerKey,
  publishedAt: series.trailerPublishedAt,
  title: series.name,
  pageUrl: `${SITE_URL}/tv-shows/${series.id}`,
  kind: 'series',
  year: yearOf(series.firstAirDate),
  genres: series.genres,
  overview: series.description,
})

/** The standalone script for a movie page; undefined without a dated YouTube trailer. */
export const movieTrailerJsonLd = (movie: MovieSchemaInput) => {
  const video = trailerObject(movieTrailerInput(movie))
  return video && { '@context': 'https://schema.org', ...video }
}

export const seriesTrailerJsonLd = (series: SeriesSchemaInput) => {
  const video = trailerObject(seriesTrailerInput(series))
  return video && { '@context': 'https://schema.org', ...video }
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
  /** ISO 639-1 code from TMDB — drives `inLanguage` instead of a hard-coded `en`. */
  originalLanguage?: string | null
  imdbId?: string | null
}

export const movieJsonLd = (movie: MovieSchemaInput) => {
  const url = `${SITE_URL}/movies/${movie.id}`
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    '@id': `${url}#movie`,
    url,
    name: movie.title,
    // The film's own language, not the site's. A Japanese or French title
    // filed as `en` is a wrong claim in the graph crawlers read.
    inLanguage: movie.originalLanguage || 'en',
    sameAs: titleSameAs('movie', movie.id, movie.imdbId),
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
  const trailer = trailerObject(movieTrailerInput(movie))
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
  /** ISO 639-1 code from TMDB — drives `inLanguage` instead of a hard-coded `en`. */
  originalLanguage?: string | null
  imdbId?: string | null
}

export const tvSeriesJsonLd = (series: SeriesSchemaInput) => {
  const url = `${SITE_URL}/tv-shows/${series.id}`
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    '@id': `${url}#tv-series`,
    url,
    name: series.name,
    inLanguage: series.originalLanguage || 'en',
    sameAs: titleSameAs('tv', series.id, series.imdbId),
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
  const trailer = trailerObject(seriesTrailerInput(series))
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
    dangerouslySetInnerHTML={{ __html: jsonLdText(data) }}
  />
)
