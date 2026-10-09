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

/**
 * The window every description lands in: Bing's 150-160 guidance.
 *
 * The floor was 120 until 2026-10-09, when Bing's report flagged 95 pages as
 * "too short" — genre hubs at 132-149, the disclaimer at 150, synopses of 130+
 * left to stand alone, and every head that fell between two of the three old
 * offers ("Stupor Mundi (1997) — history, drama movie." + the 80-character
 * offer = 123).
 */
export const MIN_LENGTH = 150
export const MAX_LENGTH = 160

/**
 * A synopsis at least this long carries the description by itself; anything
 * shorter gets the title/genre line and an offer appended.
 */
const SELF_SUFFICIENT = MIN_LENGTH

const N = siteConfig.name

/**
 * The closing sentence, longest first; the longest that still fits is used.
 * The window is ten characters wide, so no two neighbours may be more than ten
 * apart, and the longest has to lift the shortest possible head ("Up (1980) —
 * movie.", 18 characters) over the floor. tests/seo-surfaces.test.ts walks
 * every head length to hold both.
 */
const TITLE_OFFERS = [
  `Read the synopsis, browse the full cast and crew, and see ratings, trailers, similar titles and where to watch it online, on ${N}.`,
  `Read the synopsis, browse the full cast and crew, and see ratings, trailers, similar titles and where to watch, on ${N}.`,
  `Read the synopsis, browse the full cast and crew, and see ratings, trailers and where to watch it online, on ${N}.`,
  `Browse the full cast and crew, and see ratings, trailers, similar titles and where to watch it online, on ${N}.`,
  `Browse the full cast and crew, and see ratings, trailers, similar titles and where to watch, on ${N}.`,
  `Browse the full cast and crew, and see ratings, trailers and where to watch it online, on ${N}.`,
  `See the full cast and crew, ratings, trailers and where to watch it online, on ${N}.`,
  `Full cast and crew, ratings, trailers and where to watch it online, on ${N}.`,
  `Cast and crew, ratings, trailers and where to watch it online, on ${N}.`,
  `Cast, ratings, trailers and where to watch it online, on ${N}.`,
  `Cast, ratings, trailers and where to watch, on ${N}.`,
  `Cast, trailers and where to watch, on ${N}.`,
  `Cast and where to watch, on ${N}.`,
  `Where to watch it, on ${N}.`,
  `Trailer and cast on ${N}.`,
  `Trailers on ${N}.`,
  `Cast on ${N}.`,
  `On ${N}.`,
]

/** The same idea for a franchise page, which lists films rather than a cast. */
const COLLECTION_OFFERS = [
  `Every film in the series in order, with release dates, ratings, cast, trailers and where to watch each one online, on ${N}.`,
  `Every film in the series in order, with release dates, ratings, trailers and where to watch each one online, on ${N}.`,
  `Every film in the series in order, with release dates, ratings and where to watch each one online, on ${N}.`,
  `Every film in order, with release dates, ratings, trailers and where to watch each one online, on ${N}.`,
  `Every film in order, with release dates, ratings and where to watch each one online, on ${N}.`,
  `Every film in order, with release dates, ratings and where to watch each one, on ${N}.`,
  `Every film in order, with release dates, ratings and where to watch, on ${N}.`,
  `Every film in order, with ratings and where to watch each one, on ${N}.`,
  `Every film in order, with ratings and where to watch, on ${N}.`,
  `Every film in order, with where to watch each, on ${N}.`,
  `In order, with ratings and where to watch, on ${N}.`,
  `Every film in order and where to watch, on ${N}.`,
  `In order, with where to watch, on ${N}.`,
  `Where to watch each film, on ${N}.`,
  `Every film in order, on ${N}.`,
  `Every film, on ${N}.`,
  `Films on ${N}.`,
  `On ${N}.`,
]

/** A genre hub: the noun is "films" or "series". */
const genreOffers = (noun: string) => [
  `Browse top-rated and trending ${noun} with ratings, cast, trailers and where to stream each one online, on ${N}.`,
  `Browse top-rated and trending ${noun} with ratings, cast, trailers and where to stream each one, on ${N}.`,
  `Browse top-rated and trending ${noun} with ratings, trailers and where to stream each one online, on ${N}.`,
  `Browse top-rated and trending ${noun} with ratings, trailers and where to stream each one, on ${N}.`,
  `Browse top-rated and trending ${noun} with ratings, trailers and where to stream them, on ${N}.`,
  `Browse top-rated and trending ${noun} with ratings, trailers and where to watch, on ${N}.`,
  `Top-rated and trending ${noun} with ratings, trailers and where to watch, on ${N}.`,
  `Top-rated and trending ${noun}, with ratings and where to watch, on ${N}.`,
  `Top-rated and trending ${noun} and where to watch, on ${N}.`,
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

const inWindow = (text: string) =>
  text.length >= MIN_LENGTH && text.length <= MAX_LENGTH

/**
 * The first head that lands in the window whole, then the first that lands in
 * it at all, then the first. Heads come richest first, so a dropped fact line
 * or a dropped credit is what gives way — never a sentence cut in half when a
 * shorter head would have fitted.
 */
const bestOf = (heads: string[], offers: string[]) => {
  const built = heads.map((head) => assemble(head, offers))
  return (
    built.find((text) => inWindow(text) && !text.endsWith('…')) ??
    built.find(inWindow) ??
    built[0]
  )
}

export function mediaDescription(input: MediaDescriptionInput): string {
  const synopsis = squash(input.overview)
  if (synopsis.length >= SELF_SUFFICIENT) return clamp(synopsis)

  const fact = factLine(input)
  if (!synopsis) return assemble(fact, TITLE_OFFERS)
  const sentence = endSentence(synopsis)
  return bestOf([`${sentence} ${fact}`, sentence], TITLE_OFFERS)
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

  const complete = `The ${name}, complete.`
  if (!synopsis) return assemble(complete, COLLECTION_OFFERS)
  const sentence = endSentence(synopsis)
  return bestOf([`${sentence} ${complete}`, sentence], COLLECTION_OFFERS)
}

/**
 * A genre hub: "The most popular war movies right now." plus the longest offer
 * that fits. The name appears in the head only — repeated in the offer as well,
 * "War" and "Action & Adventure" landed 36 characters apart.
 */
export const genreDescription = (
  genre: string,
  kind: 'movie' | 'series'
): string => {
  const plural = kind === 'movie' ? 'movies' : 'TV shows'
  const head = `The most popular ${genre.toLowerCase()} ${plural} right now.`
  return assemble(head, genreOffers(kind === 'movie' ? 'films' : 'series'))
}

const PERSON_OFFERS = [
  `See the full filmography with characters played, ratings, trailers, release dates and where to stream each title online, on ${N}.`,
  `See the full filmography with characters played, ratings, trailers, release dates and where to stream each one, on ${N}.`,
  `See the full filmography with characters played, ratings, trailers and where to stream each title online, on ${N}.`,
  `See the full filmography with characters played, ratings, trailers and where to stream each one, on ${N}.`,
  `See the full filmography with ratings, trailers and where to stream each title online, on ${N}.`,
  `Full filmography with ratings, trailers and where to stream each title online, on ${N}.`,
  `Full filmography with ratings, trailers and where to stream each one, on ${N}.`,
  `Full filmography with ratings and where to stream each one, on ${N}.`,
  `Full filmography with ratings and where to stream, on ${N}.`,
  `Ratings, trailers and where to stream each one, on ${N}.`,
  `Ratings, streaming and what to watch next, on ${N}.`,
  `Ratings and where to stream them, on ${N}.`,
  `Ratings and where to stream, on ${N}.`,
  `Where to stream each one, on ${N}.`,
  `Where to stream, on ${N}.`,
  `Ratings on ${N}.`,
  `On ${N}.`,
]

/**
 * A person page: what they have been in, which is the query somebody typed.
 *
 * Up to three known titles, dropping from the end until the head leaves room
 * for an offer — three long titles alone ran a description to 225 characters.
 */
export const personDescription = (name: string, known: string[]): string => {
  const heads = known.length
    ? known.map(
        (_, index) =>
          `Every film and series ${name} has been in, including ${known.slice(0, known.length - index).join(', ')}.`
      )
    : [`Films and series featuring ${name}.`]
  return bestOf(heads, PERSON_OFFERS)
}

/**
 * A list's shelf line: "12 titles by Ana on Reely".
 *
 * Shared because the Worker writes it into the served head and the shell
 * writes it again after hydration (hooks/use-served-metadata.ts). Two copies
 * of the sentence is two chances for a page to describe itself differently to
 * a crawler than to the unfurler that fetched it a second earlier.
 */
export const listShelf = (count: number, owner?: string | null) =>
  `${count} ${count === 1 ? 'title' : 'titles'}${owner ? ` by ${owner}` : ''} on ${siteConfig.name}`

export const listDescription = (
  description: string | null | undefined,
  count: number,
  owner?: string | null
) => squash(description) || `${listShelf(count, owner)}.`

/** A profile describes itself by its bio, or by what is on its shelves. */
export const profileDescription = (
  bio: string | null | undefined,
  counts: { finished: number; episodes: number; lists: number }
) =>
  squash(bio) ||
  `${counts.finished} films finished, ${counts.episodes} episodes ticked off, ${counts.lists} lists worth stealing.`

/** TMDB biographies run to several thousand characters. */
const BIO_LIMIT = 1400

/**
 * Where to end a biography that runs past the limit, best boundary first.
 *
 * A cut on the nearest space lands wherever the 1400th character happens to
 * fall, and on TMDB that is very often the middle of the closing attribution:
 * the Tom Hanks page ended "Description above from the Wikipedia article Tom…",
 * which reads as a broken page AND loses the CC-BY-SA credit while keeping the
 * fragment that names it. A paragraph or a sentence ends on a complete thought.
 *
 * The half-limit floor is what stops a boundary in the first sentence from
 * throwing away most of the bio to reach it.
 */
const lastBoundary = (cut: string): number => {
  const paragraph = cut.lastIndexOf('\n')
  if (paragraph > BIO_LIMIT / 2) return paragraph
  const sentence = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('.\n'),
    cut.lastIndexOf('! '),
    cut.lastIndexOf('? ')
  )
  if (sentence > BIO_LIMIT / 2) return sentence + 1
  return cut.lastIndexOf(' ')
}

export const trimBiography = (text?: string | null): string => {
  const value = String(text ?? '').trim()
  if (value.length <= BIO_LIMIT) return value
  const cut = value.slice(0, BIO_LIMIT)
  const body = cut.slice(0, lastBoundary(cut)).trimEnd()
  // A cut that already ends a sentence does not need an ellipsis to say so.
  return /[.!?]$/.test(body) ? body : `${body}…`
}
