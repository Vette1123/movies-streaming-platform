// Static option lists for the browse filters. Bundled (not fetched) because they
// change almost never and must render instantly with zero subrequests — the
// free-plan Worker budget is 50 subrequests/invocation, so every list we can
// ship statically is one we don't spend there. Watch-provider logos ARE fetched
// (region-dependent, hundreds of entries) but client-side, off the render path.

// Curated original-language set (TMDB `with_original_language`, ISO 639-1). Not
// the full ~180-language list — just the ones a browser realistically filters by.
export const LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'hi', name: 'Hindi' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'tr', name: 'Turkish' },
  { code: 'th', name: 'Thai' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'fa', name: 'Persian' },
  { code: 'id', name: 'Indonesian' },
]

export const languageName = (code: string): string =>
  LANGUAGES.find((l) => l.code === code)?.name ?? code.toUpperCase()

// US movie ratings (TMDB `certification` + `certification_country=US`). Discover
// supports certification for MOVIES only — the TV discover endpoint has no
// certification param — so the Age Rating section is gated to movies.
export const MOVIE_CERTIFICATIONS: { value: string; label: string }[] = [
  { value: 'G', label: 'G' },
  { value: 'PG', label: 'PG' },
  { value: 'PG-13', label: 'PG-13' },
  { value: 'R', label: 'R' },
  { value: 'NC-17', label: 'NC-17' },
]

export const CERTIFICATION_COUNTRY = 'US'

// Regions offered for "Where to watch". TMDB keys provider availability by
// `watch_region`, and the provider LIST itself differs per region — so changing
// this clears the picked providers (a Netflix id in the US list may be absent
// elsewhere). Default US: the largest, most-complete catalog.
export const WATCH_REGIONS: { code: string; name: string }[] = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IN', name: 'India' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'EG', name: 'Egypt' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
]

export const DEFAULT_WATCH_REGION = 'US'

export const regionName = (code: string): string =>
  WATCH_REGIONS.find((r) => r.code === code)?.name ?? code

// Earliest year the year-range slider allows. Cinema predates this, but a browse
// filter that scrolls to 1888 is noise — 1920 covers everything a catalog like
// this realistically surfaces.
export const MIN_YEAR = 1920

// Decade quick-picks. Each writes the shared date-range plumbing
// (`from`/`to` → release_date/first_air_date), so no new API param is needed.
// `to: 9999` on the newest bucket means "up to now" (resolved to the current
// year at click time). The oldest bucket is open-ended at the bottom.
export const DECADES: { label: string; from: number; to: number }[] = [
  { label: '2020s', from: 2020, to: 9999 },
  { label: '2010s', from: 2010, to: 2019 },
  { label: '2000s', from: 2000, to: 2009 },
  { label: '1990s', from: 1990, to: 1999 },
  { label: '1980s', from: 1980, to: 1989 },
  { label: 'Classic', from: MIN_YEAR, to: 1979 },
]
