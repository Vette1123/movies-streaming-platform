/**
 * Saved filter presets — a named browse query, kept on the account.
 *
 * They live in `users.prefs` rather than in a table of their own, and that is a
 * deliberate choice rather than a shortcut. A preset is a couple of hundred
 * bytes, there are at most a handful, they are read exactly when the rest of
 * the account is read, and they are written by the same `savePrefs` round trip
 * that every other setting uses. A table would have bought a migration, an
 * endpoint, a client cache and a second sync path to keep in step, in exchange
 * for nothing this feature needs.
 *
 * The sync engine in lib/library-sync.ts was the other candidate and is the
 * wrong one: it assumes every row is a `WatchedItem` (it keys rows by
 * `type:id`), so a preset would have had to pretend to be a title.
 *
 * Everything here is pure so the caps can be tested. The caps are the point:
 * `prefs` is one TEXT column written whole on every settings change, so an
 * unbounded list here would grow every account's write forever.
 */

/** As many as anybody sensibly keeps, and small enough to write on every save. */
export const MAX_PRESETS = 12
export const MAX_PRESET_NAME = 40
/** A browse query with every filter set is ~200 chars. */
export const MAX_PRESET_QUERY = 512

export interface FilterPreset {
  id: string
  name: string
  /** The browse URL's query string, without the leading `?`. */
  query: string
  /**
   * Which browse page it was saved on — '/movies' or '/tv-shows'.
   *
   * The filters are identical on both, so the query string alone does not say
   * whether "2020s, 8+, horror" means films or shows. Applying a preset never
   * needed it (the page you are on IS the answer); a smart list, which has no
   * page, does. Optional because every preset saved before this existed has
   * none, and those are read as films.
   */
  path?: string
}

/** Short, URL-safe, and unique enough for a dozen rows on one account. */
export const newPresetId = (): string => Math.random().toString(36).slice(2, 10)

const cleanName = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  return trimmed.slice(0, MAX_PRESET_NAME)
}

/**
 * A query string this site could have produced.
 *
 * Re-serialised through `URLSearchParams` rather than trusted as text: the
 * value is put back into a URL the browser navigates to, and round-tripping it
 * is what guarantees the thing stored is a query string and nothing else. It
 * also normalises `?a=1&a=1` style duplication, so two saves of the same filter
 * state compare equal.
 */
export const cleanQuery = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length > MAX_PRESET_QUERY) return null
  const params = new URLSearchParams(
    value.startsWith('?') ? value.slice(1) : value
  )
  const out = params.toString()
  return out.length > 0 && out.length <= MAX_PRESET_QUERY ? out : null
}

/** One of the two browse pages, or nothing. Never an arbitrary path. */
const cleanPath = (value: unknown): string | null =>
  value === '/movies' || value === '/tv-shows' ? value : null

/** Which discover endpoint a preset's filters were written against. */
export const presetMediaType = (preset: { path?: string }): 'movie' | 'tv' =>
  preset.path === '/tv-shows' ? 'tv' : 'movie'

const cleanId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  return /^[a-z0-9]{4,16}$/i.test(value) ? value : null
}

/**
 * Validate and clamp what arrived, dropping anything malformed rather than
 * rejecting the whole save.
 *
 * A settings POST carries every preference at once, so failing the request over
 * one bad preset would also lose the accent colour the user was actually
 * changing. Silence on a dropped row is the right trade here; nothing else in
 * the payload depends on it.
 */
export function normalisePresets(value: unknown): FilterPreset[] {
  if (!Array.isArray(value)) return []
  const out: FilterPreset[] = []
  const seen = new Set<string>()

  for (const raw of value) {
    if (out.length >= MAX_PRESETS) break
    if (!raw || typeof raw !== 'object') continue
    const input = raw as Record<string, unknown>

    const id = cleanId(input.id)
    const name = cleanName(input.name)
    const query = cleanQuery(input.query)
    if (!id || !name || !query || seen.has(id)) continue

    seen.add(id)
    const path = cleanPath(input.path)
    out.push(path ? { id, name, query, path } : { id, name, query })
  }

  return out
}

/**
 * Add one, or replace the one with the same name.
 *
 * Same-name replacement rather than a second row: saving "Horror, 2020s" twice
 * is somebody correcting the filter behind a name they have already chosen, and
 * two identically-named presets in the list is worse than either outcome.
 * Newest first, because the reason to open this list is usually the last thing
 * saved.
 */
export function withPreset(
  current: FilterPreset[],
  preset: FilterPreset
): FilterPreset[] {
  const key = preset.name.toLowerCase()
  const rest = current.filter((item) => item.name.toLowerCase() !== key)
  return [preset, ...rest].slice(0, MAX_PRESETS)
}

export function withoutPreset(
  current: FilterPreset[],
  id: string
): FilterPreset[] {
  return current.filter((item) => item.id !== id)
}
