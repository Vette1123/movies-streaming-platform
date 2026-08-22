// Server-side stream resolution for the self-hosted player.
//
// Walks the provider's public chain — JSON API → embed page → token +
// playlist URL — and hands back a master HLS manifest that hls.js plays
// DIRECTLY from their CDN. This module runs inside cloudflare/worker.js only
// (bundled by scripts/build-worker.mjs like every other @/lib import); it is
// never shipped to the browser, which is the point: the provider's host lives
// in an env var, not in client code or this repository.
//
// Why not resolve in the browser? Two reasons. Their /api endpoint does not
// serve permissive CORS, and the embed page is HTML that would have to be
// scraped with page JavaScript — fragile and visible. Three small server
// requests per play, cached, is the whole cost.

import {
  type ResolvedStream,
  type StreamResolveResult,
} from '@/lib/stream-resolver'

/**
 * The provider fingerprints non-browser clients. This exact UA shape is what
 * their own embed player sends; a bare `Cloudflare-Workers` UA gets lighter
 * treatment upstream (measured: 403 on the embed hop without it).
 */
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36'

/** Each hop is one round trip against a site we do not control. */
const HOP_TIMEOUT_MS = 8000

export class StreamResolveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StreamResolveError'
  }
}

const fetchHop = async (url: string, headers: Record<string, string>) => {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(HOP_TIMEOUT_MS),
  })
  if (!res.ok) throw new StreamResolveError(`${url} -> ${res.status}`)
  return res
}

export const resolveDirectStream = async (
  base: string,
  target: {
    type: 'movie' | 'tv'
    id: number
    season?: number
    episode?: number
  }
): Promise<StreamResolveResult> => {
  const { type, id } = target

  // Step 1: the public JSON API maps a TMDB id to an embed path carrying a
  // fresh token. Movie ids stand alone; episodes take season/episode segments.
  const apiPath =
    type === 'tv'
      ? `/api/tv/${id}/${target.season}/${target.episode}`
      : `/api/movie/${id}`
  const apiRes = await fetchHop(`${base}${apiPath}`, {
    'User-Agent': BROWSER_UA,
    Accept: 'application/json',
    Referer: `${base}/`,
  })
  const api = (await apiRes.json()) as { src?: string }
  if (!api.src) throw new StreamResolveError('resolver returned no embed path')

  // Step 2: the embed page holds token/expires/playlist as plain JS values.
  // No headless browser needed — they sit in the initial HTML payload.
  const embedUrl = new URL(api.src, base).href
  const html = await (
    await fetchHop(embedUrl, {
      'User-Agent': BROWSER_UA,
      Referer: `${base}/`,
      Accept: 'text/html',
    })
  ).text()

  const token = html.match(/token["']\s*:\s*["']([^"']+)/)?.[1]
  const expires = html.match(/expires["']\s*:\s*["']([^"']+)/)?.[1]
  const playlist = html.match(/url\s*:\s*["'](https:\/\/[^"']+)["']/)?.[1]
  if (!token || !expires || !playlist) {
    throw new StreamResolveError('token extraction failed — provider rotated')
  }

  // Step 3: master manifest + token query, exactly the URL their own player
  // builds (`h=1` asks for the multi-audio/subtitle rendition set).
  const sep = playlist.includes('?') ? '&' : '?'
  const master = `${playlist}${sep}token=${token}&expires=${expires}&h=1`

  // Step 4: verify before handing it over. A dead master would otherwise cost
  // the visitor a full player boot before the first error. Also reads the
  // highest advertised resolution for the UI label; hls.js still runs ABR.
  const masterBody = await (
    await fetchHop(master, { 'User-Agent': BROWSER_UA })
  ).text()
  if (!masterBody.startsWith('#EXTM3U')) {
    throw new StreamResolveError('upstream did not return an HLS manifest')
  }

  let bestHeight = 0
  for (const match of masterBody.matchAll(/RESOLUTION=\d+x(\d+)/g)) {
    bestHeight = Math.max(bestHeight, Number(match[1]))
  }

  const stream: ResolvedStream = {
    url: master,
    quality: bestHeight ? `${bestHeight}p` : undefined,
  }
  return { sources: [stream] }
}
