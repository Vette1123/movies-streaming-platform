// Our companion apps, published on Google Play.
// Shared metadata + a store-open helper reused by the header, mobile drawer,
// footer and command menu — one list so a new app only lands here.

export interface CompanionApp {
  /** Stable key for analytics + React keys. */
  slug: string
  name: string
  /** One line, shown under the name in the command menu / header popover. */
  tagline: string
  androidPackage: string
  playStoreUrl: string
}

function companionApp(
  slug: string,
  name: string,
  tagline: string
): CompanionApp {
  const androidPackage = `com.mohamedgado.${slug}`
  return {
    slug,
    name,
    tagline,
    androidPackage,
    playStoreUrl: `https://play.google.com/store/apps/details?id=${androidPackage}`,
  }
}

export const COMPANION_APPS: CompanionApp[] = [
  companionApp(
    'rafiq',
    'Rafiq',
    'A private Islamic companion — prayer, Qur’an, adhkar, qibla'
  ),
  companionApp(
    'masareef',
    'Masareef',
    'An offline-first, multi-currency spending tracker'
  ),
  companionApp(
    'nafis',
    'Nafis',
    'A local-price tracker for gold, currencies and more'
  ),
]

/**
 * The off-site links that appear in both the header and the mobile drawer.
 *
 * They used to be four hand-written <Link> blocks in the header and a separate
 * four-entry array in the drawer — the same list twice, which is how the header
 * ended up with five icon buttons nobody was counting against the nav's width.
 *
 * `icon` is a key into `Icons` rather than a component so this module stays
 * free of JSX imports; each consumer resolves it.
 */
export interface ExternalLink {
  label: string
  href: string
  icon: 'gitHub' | 'twitter' | 'portfolio' | 'buyMeACoffee'
  /** Right-aligned qualifier in the drawer. */
  hint?: string
  iconClassName?: string
}

export const EXTERNAL_LINKS: ExternalLink[] = [
  {
    label: 'GitHub',
    href: 'https://github.com/Vette1123',
    icon: 'gitHub',
    hint: 'Source',
  },
  {
    label: 'X (Twitter)',
    href: 'https://twitter.com/Sadge1996',
    icon: 'twitter',
    iconClassName: 'fill-current',
  },
  {
    label: 'Portfolio',
    href: 'https://www.mohamedgado.com/',
    icon: 'portfolio',
  },
  {
    label: 'Buy me a coffee',
    href: 'https://buymeacoffee.com/vetteotp',
    icon: 'buyMeACoffee',
  },
]

/**
 * Open an app's Play listing, mirroring the apps' own deep-link behaviour: try
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
export function openOnPlayStore(app: CompanionApp): void {
  if (typeof window === 'undefined') return

  const isAndroid = /android/i.test(window.navigator.userAgent)
  if (!isAndroid) {
    window.open(app.playStoreUrl, '_blank', 'noopener,noreferrer')
    return
  }

  const fallback = window.setTimeout(() => {
    window.location.href = app.playStoreUrl
  }, 1200)

  const cancel = () => {
    window.clearTimeout(fallback)
    document.removeEventListener('visibilitychange', cancel)
  }
  document.addEventListener('visibilitychange', cancel)

  window.location.href = `market://details?id=${app.androidPackage}`
}
