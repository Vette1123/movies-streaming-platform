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
