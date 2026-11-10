import { ItemType } from '@/types/movie-result'
import { SHARE_IMAGE_HEIGHT, SHARE_IMAGE_WIDTH } from '@/lib/tmdbConfig'
import { getPosterImageURL, getShareImageURL, itemRedirect } from '@/lib/utils'

// Movies expose `title` / `release_date`; series expose `name` / `first_air_date`.
// These resolvers pick whichever field the shape carries so display and tracking
// code stops re-inlining the `a || b` fallback (and the media-type guess) at
// every call site. All are pure and allocation-free.

interface TitledMedia {
  title?: string
  name?: string
}

interface DatedMedia {
  release_date?: string
  first_air_date?: string
}

interface TypedMedia {
  media_type?: string
  first_air_date?: string
}

export function getMediaTitle(media: TitledMedia): string | undefined {
  return media.title || media.name
}

export function getMediaReleaseDate(media: DatedMedia): string | undefined {
  return media.release_date || media.first_air_date
}

// Numeric release year for analytics / structured data; null when unknown.
export function getReleaseYear(date?: string): number | null {
  return date ? Number(date.slice(0, 4)) : null
}

// Flatten TMDB genre objects to their names (undefined passthrough) — used by
// analytics payloads and JSON-LD `genre` arrays alike.
export function genreNames(genres?: { name: string }[]): string[] | undefined {
  return genres?.map((genre) => genre.name)
}

// Some TMDB payloads omit `media_type` (e.g. a /discover row); fall back to the
// presence of `first_air_date`, which only series carry.
export function resolveMediaType(media: TypedMedia): ItemType {
  if (media.media_type === 'movie' || media.media_type === 'tv') {
    return media.media_type
  }
  return media.first_air_date ? 'tv' : 'movie'
}

export function mediaDetailHref(type: ItemType, id: number | string): string {
  return `${itemRedirect(type)}/${id}`
}

export function mediaGenreBasePath(type: ItemType): string {
  return `${itemRedirect(type)}/genre`
}

// The most any list surface renders of an overview: card.tsx hard-slices at 400
// characters, and the hero + command menu line-clamp to far less. TMDB routinely
// ships 600-900, so the tail is paid for twice on the wire — once as markup, once
// in the RSC flight payload — and then thrown away in the browser. Detail pages
// show the full text, so this is applied at the LIST boundaries only (the DTOs
// and the list services), never to a details fetch.
const LIST_OVERVIEW_MAX = 400

export function capListOverviews<T extends { overview?: string }>(
  items: T[]
): T[] {
  return items.map((item) => {
    if (!item.overview || item.overview.length <= LIST_OVERVIEW_MAX) return item
    return { ...item, overview: item.overview.slice(0, LIST_OVERVIEW_MAX) }
  })
}

export interface ShareImage {
  url: string
  width: number
  height: number
}

/**
 * A title's share art with its real size: the backdrop at 1200x675, else the
 * w500 poster (TMDB posters are 2:3), else null. Feeds og:image, twitter:image
 * and JSON-LD on both the prerendered pages and the Worker's tail ids.
 */
export function getMediaShareImage(
  backdropPath?: string | null,
  posterPath?: string | null
): ShareImage | null {
  if (backdropPath)
    return {
      url: getShareImageURL(backdropPath),
      width: SHARE_IMAGE_WIDTH,
      height: SHARE_IMAGE_HEIGHT,
    }
  if (posterPath)
    return { url: getPosterImageURL(posterPath), width: 500, height: 750 }
  return null
}

// Detail-hero art for metadata: the share image's URL alone.
export function getMediaHeroImageUrl(
  backdropPath?: string | null,
  posterPath?: string | null
): string | null {
  return getMediaShareImage(backdropPath, posterPath)?.url ?? null
}

/**
 * A list of TMDB items as schema.org ListItem inputs.
 *
 * Every browse, genre and franchise page renders the same shape and now
 * publishes the same ItemList from it, so the mapping lives here rather than
 * three times in three page components. `fallbackType` covers the endpoints
 * that omit `media_type` because the whole response is one kind (a genre
 * discover, a collection's parts).
 */
export function toListEntries(
  items: (TitledMedia & TypedMedia & { id: number; poster_path?: string })[],
  fallbackType?: ItemType
): { id: number; name: string; path: string; image?: string | null }[] {
  return items
    .map((item) => {
      const name = getMediaTitle(item)
      if (!name) return null
      const type = item.media_type
        ? resolveMediaType(item)
        : (fallbackType ?? 'movie')
      return {
        id: item.id,
        name,
        path: mediaDetailHref(type, item.id),
        image: item.poster_path ? getPosterImageURL(item.poster_path) : null,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
}
