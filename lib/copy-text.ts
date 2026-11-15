// The one clipboard write. Every copy button used to run
// `void navigator.clipboard?.writeText(x)` and then show "Copied" at once, so
// where the API is missing (an http page, an in-app webview) or refused (a
// denied permission, no focus) the button said Copied and nothing was copied.
// This answers whether the text actually landed, and callers show success
// only then.

/** Copy `text`; resolves true only when it reached the clipboard. */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Refused or unavailable; try the legacy path below.
  }
  return legacyCopy(text)
}

// Webviews without the async Clipboard API still honour execCommand inside a
// user gesture. Deprecated, but it is the only path those browsers have.
function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  try {
    area.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}
