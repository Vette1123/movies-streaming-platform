// A single entry from TMDB's `images.logos` append — the official title-logo
// artwork (the stylised title treatment you see on Netflix cards).
export interface TMDBLogo {
  file_path: string
  iso_639_1: string | null
  vote_count: number
  vote_average: number
  width: number
  height: number
  aspect_ratio: number
}

// Pick the best title-logo path to render in place of the plain text title.
// Preference: English logos (they carry the actual title text) ranked by
// community vote, then any other language. SVG logos are dropped — next/image
// and the raster CDN chain can't reliably serve them — so callers always get a
// PNG/JPG or nothing (and fall back to text).
export function pickLogoPath(logos?: TMDBLogo[]): string | undefined {
  const raster = (logos ?? []).filter((l) =>
    /\.(png|jpe?g)$/i.test(l.file_path)
  )
  if (!raster.length) return undefined

  const en = raster.filter((l) => l.iso_639_1 === 'en')
  const pool = en.length ? en : raster

  const best = [...pool].sort(
    (a, b) => b.vote_count - a.vote_count || b.vote_average - a.vote_average
  )[0]

  return best?.file_path
}
