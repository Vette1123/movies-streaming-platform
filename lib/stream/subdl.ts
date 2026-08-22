// Subtitles for languages the stream itself never carries — from SubDL's
// public WEBSITE, keyless.
//
// Why the website and not their API: measured 2026-08-22, every catalog
// gates its API behind a key (OpenSubtitles anonymous search works but
// downloads return a VIP stub; SubDL's API needs a paid-tier key for
// downloads). The WEBSITE serves the same files with no account at all:
// a title page lists every subtitle entry with data-language attributes,
// each entry linking a plain dl.subdl.com ZIP. Their own meta description
// says it: "41 languages ... No account needed."
//
// Cost model (the free-plan constraint): one search page + one title page +
// one zip per (title, language), then `caches.default` holds the converted
// VTT for a day. Hundreds of thousands of viewers cost hundreds of upstream
// requests, not one per view.
//
// Runs inside cloudflare/worker.js only.

import { unzipSync } from 'fflate'

import type { SelfHostTarget } from '@/lib/stream-resolver'
import { srtToVtt } from '@/lib/stream/srt'

const SITE = 'https://subdl.com'

/** Each hop is one round trip against a site we do not control. */
const HOP_TIMEOUT_MS = 10000

/** A browser UA: the site is Cloudflare-fronted and scores bare clients. */
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36'

/**
 * Languages offered through this path, mapped onto the site's own slug names
 * (its data-language attributes, e.g. "arabic", "farsipersian"). Curated
 * rather than all 41: every extra language widens the selector for nobody.
 */
export const EXTERNAL_SUBTITLE_LANGUAGES: Record<
  string,
  { slug: string; label: string }
> = {
  ar: { slug: 'arabic', label: 'العربية · Arabic' },
  en: { slug: 'english', label: 'English' },
  fr: { slug: 'french', label: 'Français · French' },
  de: { slug: 'german', label: 'Deutsch · German' },
  es: { slug: 'spanish', label: 'Español · Spanish' },
  tr: { slug: 'turkish', label: 'Türkçe · Turkish' },
  pt: { slug: 'portuguese', label: 'Português · Portuguese' },
  ru: { slug: 'russian', label: 'Русский · Russian' },
  it: { slug: 'italian', label: 'Italiano · Italian' },
  id: { slug: 'indonesian', label: 'Indonesia · Indonesian' },
  fa: { slug: 'farsipersian', label: 'فارسی · Persian' },
}

export const externalSubtitleLanguages = (): string[] =>
  Object.keys(EXTERNAL_SUBTITLE_LANGUAGES)

export class SubtitleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SubtitleError'
  }
}

const fetchPage = async (url: string): Promise<string> => {
  const res = await fetch(url, {
    headers: { 'User-Agent': BROWSER_UA, Referer: `${SITE}/` },
    signal: AbortSignal.timeout(HOP_TIMEOUT_MS),
  })
  if (!res.ok) throw new SubtitleError(`${url} -> ${res.status}`)
  return res.text()
}

/** One parsed subtitle entry from a title page. */
export interface SubdlEntry {
  languageSlug: string
  url: string
  seasonFrom?: number
  episodeFrom?: number
  fullSeason?: boolean
}

/**
 * Pair every download link with the language block that contains it.
 *
 * The page marks each entry's root with `data-language="..."` and puts the
 * dl link inside, so "nearest preceding marker" IS the pairing rule — no
 * fragile DOM tree needed. Exported pure for tests.
 */
export const parseSubdlEntries = (html: string): SubdlEntry[] => {
  const entries: SubdlEntry[] = []
  const marker = /data-language="([a-z]+)"/g
  const link = /https?:\/\/dl\.subdl\.com\/subtitle\/[^"'<>\s\\]+/g

  // Walk both cursors in document order: a link belongs to the most recent
  // language marker before it.
  const markers: { index: number; slug: string }[] = []
  let m: RegExpExecArray | null
  while ((m = marker.exec(html))) markers.push({ index: m.index, slug: m[1] })

  let cursor = 0
  while ((m = link.exec(html))) {
    while (cursor < markers.length && markers[cursor].index < m.index) cursor++
    const owner = markers[cursor - 1]
    if (!owner) continue

    // Season/episode scoping lives as data-* attrs in the same entry block;
    // grab whatever sits between the owning marker and this link.
    const block = html.slice(owner.index, m.index)
    const num = (name: string) =>
      Number(block.match(new RegExp(`data-${name}="(\\d+)"`))?.[1]) || undefined

    entries.push({
      languageSlug: owner.slug,
      url: m[0],
      seasonFrom: num('season-from'),
      episodeFrom: num('episode-from'),
      fullSeason: /data-full-season="1"/.test(block) || undefined,
    })
  }
  return entries
}

const decodeSrt = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    // Community uploads are frequently windows-1256/1252; WHATWG ships those.
    return new TextDecoder('windows-1256').decode(bytes)
  }
}

const findTitlePage = async (
  query: string,
  year?: number
): Promise<string | null> => {
  const html = await fetchPage(
    `${SITE}/search/${encodeURIComponent(query).replace(/%20/g, '%20')}`
  )
  // Title pages are /subtitle/sd<id>/<slug>; first hit wins because the site
  // already ranks by relevance. Year disambiguates remakes when present.
  const hrefs = [...html.matchAll(/\/subtitle\/(sd\d+\/[a-z0-9-]+)/gi)].map(
    (match) => match[1]
  )
  if (!hrefs.length) return null
  if (year) {
    const titled = hrefs.find((href) => href.includes(String(year)))
    if (titled) return `${SITE}/subtitle/${titled}`
  }
  return `${SITE}/subtitle/${hrefs[0]}`
}

/**
 * The finished VTT text for `target` in `lang`, or null when the catalog has
 * nothing matching. Throws only on network/format failures.
 */
export const fetchExternalSubtitlesVtt = async (
  target: Pick<SelfHostTarget, 'type' | 'id' | 'season' | 'episode'>,
  lang: string,
  context: { title: string; year?: number }
): Promise<string | null> => {
  const language = EXTERNAL_SUBTITLE_LANGUAGES[lang]
  if (!language) throw new SubtitleError(`unsupported language ${lang}`)

  const page = await findTitlePage(context.title, context.year)
  if (!page) return null

  const html = await fetchPage(page)
  const entries = parseSubdlEntries(html)

  // Episode queries prefer an exact episode match, then any same-season
  // pack, then unscoped entries (movies carry none of the season attrs).
  const candidates = entries.filter(
    (entry) => entry.languageSlug === language.slug
  )
  const scoped = candidates.filter((entry) => entry.seasonFrom === undefined)
  const exactEpisode = candidates.filter(
    (entry) =>
      entry.seasonFrom === target.season &&
      (entry.episodeFrom === undefined || entry.episodeFrom === target.episode)
  )
  const pool =
    target.type === 'tv'
      ? exactEpisode.length
        ? exactEpisode
        : candidates.filter((entry) => entry.seasonFrom === target.season)
      : scoped.length
        ? scoped
        : candidates
  if (!pool.length) return null

  // Entries lie about their format: measured on Fight Club, 1 of the first
  // 8 "arabic" .zip links was actually a RAR (fflate would reject it). Walk
  // the pool and stop at the first payload that really is a ZIP — bounded
  // so a poisoned catalog can't fan out requests.
  const MAX_ZIP_ATTEMPTS = 3
  let files: Record<string, Uint8Array> | null = null
  for (const candidate of pool.slice(0, MAX_ZIP_ATTEMPTS)) {
    const zipRes = await fetch(candidate.url, {
      headers: { 'User-Agent': BROWSER_UA, Referer: `${SITE}/` },
      signal: AbortSignal.timeout(HOP_TIMEOUT_MS),
    })
    if (!zipRes.ok) continue
    const bytes = new Uint8Array(await zipRes.arrayBuffer())
    // Local file header magic "PK\x03\x04".
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03)) continue
    files = unzipSync(bytes)
    break
  }
  if (!files) throw new SubtitleError('no readable subtitle archive found')

  // Zips hold one or more .srt releases; the biggest file is the likeliest
  // complete translation, not a sample or an ad read-me.
  const srts = Object.entries(files).filter(([name]) =>
    name.toLowerCase().endsWith('.srt')
  )
  if (!srts.length) throw new SubtitleError('zip contained no .srt')
  srts.sort((a, b) => b[1].length - a[1].length)

  return srtToVtt(decodeSrt(srts[0][1]))
}
