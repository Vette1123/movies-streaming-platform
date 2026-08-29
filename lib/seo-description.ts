// The meta description for a movie or series, in ONE place.
//
// It used to be `overview.slice(0, 200) || 'Details, cast, and streaming info
// for X on Reely.'`, written out twice — once in lib/media-page.ts for the
// prerendered detail pages and once in cloudflare/worker.js for the tail ids
// the Worker assembles. Bing's SEO report flagged 53 pages for "meta
// description too short", every one of them a title whose TMDB overview is a
// single line or missing entirely ("Japanese nunsplitation movie from 1998" is
// 38 characters; the generic fallback is 48). Search engines want 150-160.
//
// The 200-character slice was wrong at the other end too: it cut mid-word
// ("...but the time for Ayane's discharge draws closer while Sana will be
// stuck i") and 200 is past the ~160 a SERP renders anyway.
//
// So: trim on a word boundary, and when the synopsis cannot fill the slot on
// its own, spend the rest of the budget on facts that are true for every title
// — what it is, when it came out, and what the page actually offers.

import { siteConfig } from '@/config/site'

/** What a SERP renders before it truncates, with a character of slack. */
const MAX_LENGTH = 158

/**
 * A synopsis at least this long carries the description by itself; anything
 * shorter gets the title/genre line and an offer appended.
 */
const SELF_SUFFICIENT = 130

/**
 * The closing sentence, longest first. Whichever one still fits is used, so a
 * one-line synopsis and a missing one both land near the 158 budget instead of
 * one of them coming out at 90 characters.
 */
const TITLE_OFFERS = [
  `Read the synopsis, browse the full cast and crew, and see ratings, trailers and where to watch it online, on ${siteConfig.name}.`,
  `Full cast and crew, ratings, trailers and where to watch it online, on ${siteConfig.name}.`,
  `Cast, ratings, trailers and where to watch, on ${siteConfig.name}.`,
]

/** The same idea for a franchise page, which lists films rather than a cast. */
const COLLECTION_OFFERS = [
  `Every film in order, with release dates, ratings and where to watch each one, on ${siteConfig.name}.`,
  `Every film in order, with ratings and where to watch each one, on ${siteConfig.name}.`,
  `In order, with ratings and where to watch, on ${siteConfig.name}.`,
]

const squash = (value?: string | null) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()

/** Cut to `max` on a word boundary. The ellipsis is only added if text was lost. */
const clamp = (text: string, max = MAX_LENGTH) => {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  const kept = space > 0 ? cut.slice(0, space) : cut
  return `${kept.replace(/[\s.,;:!?—-]+$/, '')}…`
}

/** "Forbidden Daughters (1927) — drama, romance movie." */
const factLine = ({ title, year, kind, genres }: MediaDescriptionInput) => {
  const named = year ? `${title} (${year})` : title
  const label = [genres?.slice(0, 2).join(', ').toLowerCase(), kind]
    .filter(Boolean)
    .join(' ')
  return `${named} — ${label}.`
}

/** A sentence ends in punctuation, so the next one does not run into it. */
const endSentence = (text: string) => (/[.!?…]$/.test(text) ? text : `${text}.`)

export interface MediaDescriptionInput {
  title: string
  /** Release / first-air year, when TMDB has a date. */
  year?: string
  kind: 'movie' | 'series'
  /** Genre names, in TMDB's order. The first two are used. */
  genres?: string[]
  overview?: string | null
}

/**
 * Spend what is left of the budget on the longest closing sentence that still
 * fits whole. An offer cut in half mid-word would be worse than none.
 */
const fill = (head: string, offers: string[]) =>
  offers.find((offer) => `${head} ${offer}`.length <= MAX_LENGTH) ?? ''

const assemble = (head: string, offers: string[]) => {
  const offer = fill(head, offers)
  return offer ? `${head} ${offer}` : clamp(head)
}

export function mediaDescription(input: MediaDescriptionInput): string {
  const synopsis = squash(input.overview)
  if (synopsis.length >= SELF_SUFFICIENT) return clamp(synopsis)

  const head = [synopsis && endSentence(synopsis), factLine(input)]
    .filter(Boolean)
    .join(' ')
  return assemble(head, TITLE_OFFERS)
}

/**
 * A franchise page. TMDB leaves `overview` empty on most collections, so this
 * one was almost always the 40-character `Every film in the X on Reely.`
 */
export function collectionDescription(
  name: string,
  overview?: string | null
): string {
  const synopsis = squash(overview)
  if (synopsis.length >= SELF_SUFFICIENT) return clamp(synopsis)

  const head = [synopsis && endSentence(synopsis), `The ${name}, complete.`]
    .filter(Boolean)
    .join(' ')
  return assemble(head, COLLECTION_OFFERS)
}
