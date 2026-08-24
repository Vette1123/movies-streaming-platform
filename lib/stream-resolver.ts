// What plays, expressed as data.
//
// This module used to hold the whole self-hosted pipeline (resolve chain,
// SubDL subtitles); the player now lives on its own worker
// (reely-pro-player) and this file is down to the shape both halves agree on:
// the detail heroes build one of these from TMDB data and hand it to
// components/player/reely-player.tsx, which exchanges it for a signed ticket
// at /api/pro/ticket (cloudflare/worker.js).

export interface SelfHostTarget {
  type: 'movie' | 'tv'
  id: number
  /** Required when type is 'tv'. */
  season?: number
  episode?: number
  /** Display title, used by the player's external-subtitle catalogs. */
  title?: string
  /** Release year — disambiguates remakes in those catalogs. */
  year?: number
  /**
   * IMDb id (tt…). The deepest subtitle catalog the player can reach is keyed
   * by it and nothing else; detail pages already hold one, because the TMDB
   * request that renders them appends external_ids.
   */
  imdb?: string
}
