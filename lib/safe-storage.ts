// localStorage that never throws. Safari can hand back `null` for
// `window.localStorage` (private mode, blocked cookies, some in-app webviews),
// and any browser throws on a full quota or a disabled store. A preference
// that cannot be read is simply unset; one that cannot be written is lost for
// this visit. Neither is worth crashing a render over (PostHog 2026-11-15:
// "null is not an object (evaluating 'window.localStorage.getItem')").

export function storageGet(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function storageSet(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage?.setItem(key, value)
  } catch {
    // Storage is unavailable or full; the value lives for this visit only.
  }
}
