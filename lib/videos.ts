import { Video } from '@/types/video'

// Rank the best clip to surface as "the trailer". We only embed YouTube (the
// player component below assumes youtube.com/embed), so non-YouTube sites are
// dropped. Preference: official Trailer > any Trailer > official Teaser >
// Teaser > anything else. Within a tier the most recently published wins so
// re-releases / final trailers beat older teasers.
const TYPE_RANK: Record<string, number> = {
  Trailer: 0,
  Teaser: 1,
  Clip: 2,
  Featurette: 3,
}

export function pickTrailer(videos?: Video[]): Video | undefined {
  const youtube = (videos ?? []).filter((v) => v.site === 'YouTube' && !!v.key)
  if (!youtube.length) return undefined

  const score = (v: Video) =>
    (TYPE_RANK[v.type] ?? 9) * 2 + (v.official ? 0 : 1)

  const best = [...youtube].sort((a, b) => {
    const diff = score(a) - score(b)
    if (diff !== 0) return diff
    // Same tier → newest first.
    return (
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    )
  })[0]

  return best
}

/**
 * The same pick, as the key the embed needs.
 *
 * Kept as its own export because seventeen files ask for the key and one — the
 * VideoObject in lib/structured-data.tsx — needs the clip's real publish date.
 * Widening the shape everybody already destructures would have been a
 * seventeen-file diff for one field.
 */
export const pickTrailerKey = (videos?: Video[]): string | undefined =>
  pickTrailer(videos)?.key
