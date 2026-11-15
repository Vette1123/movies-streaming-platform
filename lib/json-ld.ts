import { isImdbId } from '@/lib/imdb-id'

/**
 * schema.org AggregateRating from a TMDB vote average and count, or undefined
 * with no votes. One shape for the prerendered pages and the Worker's tail ids:
 * they used to disagree (worstRating 0 vs 1, strings vs numbers). TMDB votes
 * run 1-10.
 */
export function aggregateRating(
  voteAverage?: number | null,
  voteCount?: number | null
) {
  if (typeof voteAverage !== 'number' || !voteCount) return undefined
  return {
    '@type': 'AggregateRating',
    ratingValue: Number(voteAverage.toFixed(1)),
    bestRating: 10,
    worstRating: 1,
    ratingCount: voteCount,
  }
}

/**
 * JSON for inside a <script type="application/ld+json">. Escapes `<` so a
 * value (a user's list name, a TMDB overview) can never close the script, and
 * U+2028/U+2029 for older parsers. JSON.parse reads the escapes back as-is.
 */
export const jsonLdText = (data: unknown): string =>
  JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

/**
 * The same title on the databases search engines already trust.
 *
 * Unlike a person's id (see personList), a title's TMDB id is the id this page
 * is built from, so the claim is true by construction; IMDb only when the
 * payload already carries it, never a guessed or looked-up one. Shared with
 * the Worker's tail-id fallback, like aggregateRating, so both say the same.
 */
/**
 * The Worker's tail-id Movie / TVSeries node. It has to name the same entity,
 * with the same properties, as movieJsonLd / tvSeriesJsonLd in
 * lib/structured-data.tsx do for prerendered ids: it drifted once (a TVSeries
 * with `datePublished` instead of `startDate`, no `@id`, no `inLanguage`) on
 * ~13,900 URLs. tests/tail-json-ld.test.ts holds the two together. It lives
 * here, not there, because that module is React and the Worker stays lean.
 */
export function tailTitleJsonLd(input: {
  type: 'movie' | 'tv'
  id: number | string
  name: string
  canonical: string
  description: string
  image?: string | null
  genres?: string[]
  /** YYYY-MM-DD: release date for a movie, first air date for a series. */
  released?: string
  duration?: string
  rating?: { value: number; count: number } | null
  originalLanguage?: string | null
  imdbId?: string | null
}): Record<string, unknown> {
  const tv = input.type === 'tv'
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': tv ? 'TVSeries' : 'Movie',
    '@id': `${input.canonical}#${tv ? 'tv-series' : 'movie'}`,
    url: input.canonical,
    name: input.name,
    inLanguage: input.originalLanguage || 'en',
    description: input.description,
    sameAs: titleSameAs(input.type, input.id, input.imdbId),
  }
  if (input.image) schema.image = input.image
  if (input.genres?.length) schema.genre = input.genres
  if (input.released) {
    if (tv) schema.startDate = input.released
    else {
      schema.datePublished = input.released
      schema.dateCreated = input.released
    }
  }
  if (input.duration) schema.duration = input.duration
  const rating = aggregateRating(input.rating?.value, input.rating?.count)
  if (rating) schema.aggregateRating = rating
  return schema
}

export const titleSameAs = (
  kind: 'movie' | 'tv',
  id: number | string,
  imdbId?: string | null
): string[] => {
  const links = [`https://www.themoviedb.org/${kind}/${id}`]
  if (isImdbId(imdbId)) {
    links.push(`https://www.imdb.com/title/${imdbId}/`)
  }
  return links
}
