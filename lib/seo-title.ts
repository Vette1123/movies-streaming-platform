import { siteConfig } from '@/config/site'

/**
 * What goes in `<title>`, for the pages Next does not render.
 *
 * A prerendered page gets ` | Reely` appended by the root layout's title
 * template (`app/layout.tsx`). Two places bypass that template and set the
 * title by hand — the Worker, which replaces the shell's `<title>` while
 * streaming a tail id, and `useServedMetadata`, which writes it back after
 * hydration — so without this a tail page's tab and SERP title read differently
 * from its prerendered twin. It was the last difference left between them.
 *
 * A heading that already names the site (a public profile, the lists
 * directory) is left alone rather than saying it twice.
 */
export const docTitle = (heading: string) =>
  heading.includes(siteConfig.name)
    ? heading
    : `${heading} | ${siteConfig.name}`

export interface MediaTitleInput {
  title: string
  /** Release / first-air year, when TMDB has a date. */
  year?: string
  kind: 'movie' | 'series'
}

/**
 * "The Shawshank Redemption (1994)" — the name of the thing, nothing else.
 *
 * The `<h1>`, `og:title` and `twitter:title` all want exactly this: an unfurled
 * card in a chat is a poster with a name under it, not a search result. Written
 * out three times before this — lib/media-page.ts, app/media-fallback/page.tsx
 * and cloudflare/worker.js each carried the same ternary.
 */
export const mediaHeading = ({ title, year }: MediaTitleInput) =>
  year ? `${title} (${year})` : title

/**
 * What a `<title>` is FOR, which is not what an `og:title` is for.
 *
 * `<title>` is a ranking input and the clickable line of a search result, so it
 * has to carry the words people actually type. Measured in Search Console over
 * the 28 days to 29 Aug 2026: 8.4k impressions, 264 clicks, average position
 * 24.7, and the clicks were almost entirely brand queries — "reely movie" (40),
 * "reely.space" (37), "reely space" (35). The title queries brought impressions
 * and no clicks at all: "daddy's in trouble" 814 impressions / 2 clicks, "to
 * the max 2026" 190 / 0.
 *
 * A title of `Daddy's in Trouble (2026) | Reely` can only ever match the bare
 * name, which is the one query IMDb, Wikipedia and Rotten Tomatoes already own.
 * The modifiers are where a catalogue this size can compete — "where to watch
 * X", "X cast", "X seasons" — and every one of them describes something already
 * on the page. JustWatch and Reelgood title their pages the same way.
 *
 * Discovery framing only: "where to watch", never "watch free". See
 * docs/marketing/launch-kit.md — the rule covers anything rendered, and a SERP
 * title is rendered more than any asset the site ships.
 */
const TITLE_INTENT: Record<MediaTitleInput['kind'], string> = {
  movie: 'Cast, Trailer & Where to Watch',
  series: 'Seasons, Cast & Where to Watch',
}

export const mediaDocHeading = (input: MediaTitleInput) =>
  `${mediaHeading(input)} — ${TITLE_INTENT[input.kind]}`

/**
 * The two rail headings on a detail page, which used to be the same eight
 * characters on every one of ~13,000 URLs.
 *
 * "Similar Movies" and "Recommended Movies" are boilerplate: they say nothing a
 * person searches for, and repeated verbatim across the catalogue they are part
 * of what makes one detail page look like a copy of the next. "Movies like Fight
 * Club" is a query with real volume that IMDb does not own the way it owns the
 * bare title, and the rail underneath it is already the answer — TMDB's
 * `similar` and `recommendations` arrive in the same `append_to_response` the
 * page renders from, so this costs no extra request and no extra CPU.
 *
 * These are `<h2>`s in components/list.tsx, and the Worker's crawler block picks
 * up nothing here — a tail page gets its body from lib/seo-facts.ts.
 */
const LIKE_NOUN: Record<MediaTitleInput['kind'], string> = {
  movie: 'Movies',
  series: 'Shows',
}

export const similarHeading = (title: string, kind: MediaTitleInput['kind']) =>
  `${LIKE_NOUN[kind]} like ${title}`

export const recommendedHeading = (title: string) => `If you liked ${title}`
