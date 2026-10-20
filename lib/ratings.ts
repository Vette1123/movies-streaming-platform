// The ratings a details page shows, and where each one comes from.
//
// Four sources, and every one of them is free:
//
//   IMDb            IMDb's own free Non-Commercial dataset, pre-sharded into
//                   static JSON by scripts/build-imdb-ratings.mjs. No key, no
//                   rate limit, and the detail payload already carries the
//                   imdb_id, so it costs no request at all.
//   Rotten Tomatoes OMDb's free tier carries the Tomatometer. No official RT
//                   API is free, and the unofficial ones are somebody's
//                   server.
//   Metacritic      The same OMDb answer.
//   TMDB            Already in the payload (vote_average / vote_count).
//
// The rule the whole thing hangs on: a rating lookup must not cost a TMDB
// request. The detail page already has the imdb_id, so the IMDb shard read is
// a local file and the OMDb call is a different host. Nothing here adds a
// subrequest to a Worker invocation, which is the cap that broke the homepage
// once.
import { cache } from 'react'

import { getOmdbRatings } from '@/services/omdb'

export type RatingSourceId = 'imdb' | 'rottenTomatoes' | 'metacritic' | 'tmdb'

export interface RatingTile {
  id: RatingSourceId
  /** The source's name, the way it is known. */
  label: string
  /** The score, in that source's own scale: 8.6, 93%, 82. */
  score: string
  /** The line under the score: a vote count, an audience score. */
  detail?: string
  /** The accent the score wears. The source's own convention, not a theme. */
  tone:
    | 'imdb'
    | 'fresh'
    | 'rotten'
    | 'metacritic-good'
    | 'metacritic-mid'
    | 'metacritic-bad'
    | 'tmdb'
}

/** A vote count the way a person reads it: 2.9M, 12.4K, 843. */
export const formatVotes = (votes?: number | null): string | undefined => {
  if (votes === undefined || votes === null || !Number.isFinite(votes)) {
    return undefined
  }
  if (votes < 0) return undefined
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(votes)
}

/** "2.9M votes" — the number alone reads as a count of nothing. */
const votesDetail = (votes?: number | null): string | undefined => {
  const formatted = formatVotes(votes)
  return formatted ? `${formatted} votes` : undefined
}

/**
 * Rotten Tomatoes' Tomatometer is the critics' score. OMDb carries that one
 * and not the audience score — a second number about the same film, from a
 * source that would cost money — so the tile shows the critic score alone
 * rather than half of a pair.
 */

/**
 * The tiles, in the order a reader expects them: the two scores people quote
 * (IMDb and Rotten Tomatoes) first, then the critics' aggregate, then our own.
 *
 * A source with no score is not rendered at all. An empty box saying "NR" is
 * a claim about the film; a missing box is not.
 */
export const buildRatingTiles = (input: {
  imdbRating?: string | number | null
  imdbVotes?: number | null
  rottenTomatoes?: number | null
  metacritic?: number | null
  tmdbAverage?: number | null
  tmdbVotes?: number | null
}): RatingTile[] => {
  const tiles: RatingTile[] = []

  const imdbScore =
    typeof input.imdbRating === 'string'
      ? Number.parseFloat(input.imdbRating)
      : (input.imdbRating ?? NaN)
  if (Number.isFinite(imdbScore) && imdbScore > 0) {
    tiles.push({
      id: 'imdb',
      label: 'IMDb',
      score: imdbScore.toFixed(1),
      detail: votesDetail(input.imdbVotes),
      tone: 'imdb',
    })
  }

  if (
    input.rottenTomatoes !== undefined &&
    input.rottenTomatoes !== null &&
    Number.isFinite(input.rottenTomatoes)
  ) {
    const critic = Math.round(input.rottenTomatoes)
    tiles.push({
      id: 'rottenTomatoes',
      label: 'Rotten Tomatoes',
      score: `${critic}%`,
      // RT's own line: 60% and up is "Fresh", below is "Rotten". The colour
      // says the same thing the number does, which is the point of a colour
      // here — it is not decoration.
      tone: critic >= 60 ? 'fresh' : 'rotten',
    })
  }

  if (
    input.metacritic !== undefined &&
    input.metacritic !== null &&
    Number.isFinite(input.metacritic)
  ) {
    const score = Math.round(input.metacritic)
    tiles.push({
      id: 'metacritic',
      label: 'Metacritic',
      score: String(score),
      // Metacritic's own bands: 75+ is generally favourable, 50-74 mixed,
      // below that unfavourable.
      tone:
        score >= 75
          ? 'metacritic-good'
          : score >= 50
            ? 'metacritic-mid'
            : 'metacritic-bad',
    })
  }

  if (
    input.tmdbAverage !== undefined &&
    input.tmdbAverage !== null &&
    Number.isFinite(input.tmdbAverage) &&
    input.tmdbAverage > 0
  ) {
    tiles.push({
      id: 'tmdb',
      label: 'TMDB',
      score: input.tmdbAverage.toFixed(1),
      detail: votesDetail(input.tmdbVotes),
      tone: 'tmdb',
    })
  }

  return tiles
}

/**
 * Every rating we can get for a title, in one call.
 *
 * The IMDb score comes from the free dataset shard (a local file at build
 * time, a static asset in the Worker). The OMDb answer carries the IMDb vote
 * count, the Tomatometer and the Metascore.
 */
export const getMediaRatings = cache(
  async (input: {
    imdbId?: string | null
    imdbRating?: string | null
    tmdbAverage?: number | null
    tmdbVotes?: number | null
  }): Promise<RatingTile[]> => {
    const omdb = await getOmdbRatings(input.imdbId)
    const imdbRating = input.imdbRating ?? omdb?.imdbRating?.toFixed(1) ?? null

    return buildRatingTiles({
      imdbRating,
      imdbVotes: omdb?.imdbVotes,
      rottenTomatoes: omdb?.rottenTomatoes,
      metacritic: omdb?.metacritic,
      tmdbAverage: input.tmdbAverage,
      tmdbVotes: input.tmdbVotes,
    })
  }
)
