// What a resolved stream looks like, shared by both halves of the contract.
//
// The browser half lives in lib/api-client.ts (`resolveStreamApi`); the server
// half is lib/stream/vixsrc.ts, which cloudflare/worker.js calls from
// /api/stream/resolve. These types are the whole interface between them.

export interface SelfHostTarget {
  type: 'movie' | 'tv'
  id: number
  /** Required when type is 'tv'. */
  season?: number
  episode?: number
  /** Display title, used by external-subtitle catalogs to find the page. */
  title?: string
  /** Release year — disambiguates remakes in those catalogs. */
  year?: number
}

/** One playable HLS manifest. */
export interface ResolvedStream {
  /**
   * Master m3u8 URL, played DIRECTLY by hls.js from the provider CDN.
   *
   * Verified against the configured provider on 2026-08-22: the master, every
   * variant and audio playlist, all segments AND the AES-128 decryption key
   * answer `access-control-allow-origin: *` with no Referer lock — so media
   * bytes never flow through our Worker. That is load-bearing on the free
   * plan: one resolve costs ~3 tiny subrequests, then the browser talks to
   * their CDN for the rest of the film.
   */
  url: string
  /** Highest resolution advertised in the master playlist, e.g. "1080p". */
  quality?: string
}

export interface StreamResolveResult {
  sources: ResolvedStream[]
  /**
   * Languages the Worker can serve as EXTERNAL subtitle tracks through
   * /api/stream/subtitles.vtt — currently just 'ar' when a SubDL key is
   * configured. Empty when not configured: the player then offers only the
   * stream's embedded tracks and hides the rest.
   */
  externalSubtitleLangs?: string[]
}
