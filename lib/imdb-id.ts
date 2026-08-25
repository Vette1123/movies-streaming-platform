/**
 * What an IMDb title id looks like: `tt` and 5–12 digits.
 *
 * One definition, three callers — the import parser, the import router, and
 * the playback ticket that hands the id to the player worker. It lives here
 * because the third copy was written as `/^ttd{5,12}$/` (a lost backslash, so
 * it matched `tt` followed by literal `d`s and therefore nothing real). That
 * silently dropped the id from every play URL, which cost the player its
 * cheapest subtitle source and sent every request down the three-catalog walk
 * instead — measured as CPU p50 1.1ms -> 6.4ms. A dead regex fails quietly;
 * having one place to test is the point.
 */
const IMDB_ID = /^tt\d{5,12}$/i

export const isImdbId = (value: unknown): value is string =>
  typeof value === 'string' && IMDB_ID.test(value)
