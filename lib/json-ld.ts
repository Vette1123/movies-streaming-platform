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
