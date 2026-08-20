/**
 * Bump when the icon or launch-screen art changes.
 *
 * The files in `public/` have fixed names, and three separate caches decide on
 * their own how long to keep the old picture:
 *
 *   1. HTTP. `public/_headers` gives the brand assets `max-age=604800`, so a
 *      returning visitor can hold last week's icon for a week.
 *   2. The browser's favicon store, which is not the HTTP cache and does not
 *      honour a purge.
 *   3. An INSTALLED PWA, which is the one that matters. Android keeps the
 *      home-screen icon it was installed with until the manifest's icon `src`
 *      STRING changes. New bytes at an unchanged URL reach it never.
 *
 * A query string is the only lever all three agree to respect, because to each
 * of them `?v=2` is simply a different resource. Nothing serves it: Workers
 * Static Assets matches on path and ignores the query, so the same file comes
 * back either way.
 *
 * Changing this constant is not enough on its own — `public/site.webmanifest`
 * and `public/browserconfig.xml` are static files that carry the same `?v=` by
 * hand. `tests/icons.test.ts` fails when they drift.
 */
export const ICON_VERSION = '2'

/** Appends the cache-busting version to an icon or launch-screen path. */
export const versionedIcon = (path: string): string =>
  `${path}?v=${ICON_VERSION}`
