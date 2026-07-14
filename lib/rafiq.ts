// Rafiq — our companion app, published on Google Play.
// Shared metadata + a store-open helper reused by the footer and command menu.

export const RAFIQ_ANDROID_PACKAGE = 'com.mohamedgado.rafiq'
export const RAFIQ_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${RAFIQ_ANDROID_PACKAGE}`

const RAFIQ_MARKET_URL = `market://details?id=${RAFIQ_ANDROID_PACKAGE}`

/**
 * Open Rafiq's Play listing, mirroring the app's own deep-link behaviour: try
 * the native Play Store app first, then fall back to the web listing.
 *
 * - Non-Android (desktop, iOS): `market://` can't be handled, so we open the
 *   web listing directly in a new tab. On Android the web URL itself hands off
 *   to the Play Store app when installed.
 * - Android: navigate to `market://` to launch the Play Store app. If nothing
 *   handles it (app missing) the page stays visible, so a short timeout falls
 *   back to the web listing. A successful hand-off hides the page, which
 *   cancels the fallback.
 */
export function openRafiqOnPlayStore(): void {
  if (typeof window === 'undefined') return

  const isAndroid = /android/i.test(window.navigator.userAgent)
  if (!isAndroid) {
    window.open(RAFIQ_PLAY_STORE_URL, '_blank', 'noopener,noreferrer')
    return
  }

  const fallback = window.setTimeout(() => {
    window.location.href = RAFIQ_PLAY_STORE_URL
  }, 1200)

  const cancel = () => {
    window.clearTimeout(fallback)
    document.removeEventListener('visibilitychange', cancel)
  }
  document.addEventListener('visibilitychange', cancel)

  window.location.href = RAFIQ_MARKET_URL
}
