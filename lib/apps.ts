// Our companion apps. Shared metadata + a store-open helper reused by the
// header, mobile drawer, footer and command menu — one list so a new app only
// lands here.
//
// This list was Play-only by construction: one `playStoreUrl` per app and an
// `openOnPlayStore` that sent every visitor to Google Play. Rafiq and Masareef
// have shipped on the App Store since, so an iPhone reader tapping "Masareef"
// landed on a listing they cannot install from. An app that is on both stores
// therefore carries `appStoreUrl` and `installUrl`, and it is `installUrl` —
// the chooser page the apps themselves link to — that a desktop reader gets,
// because from a laptop we cannot know which phone they will install on.
//
// Nafis is Android-only, so it has neither, and `storesLabel` says so rather
// than inheriting a claim from its neighbours.

export interface CompanionApp {
  /** Stable key for analytics + React keys. */
  slug: string
  name: string
  /** One line, shown under the name in the command menu / header popover. */
  tagline: string
  androidPackage: string
  playStoreUrl: string
  /** Set only for apps that shipped on the App Store. */
  appStoreUrl?: string
  /** The app's own "pick your store" page. Present iff `appStoreUrl` is. */
  installUrl?: string
}

function companionApp(
  slug: string,
  name: string,
  tagline: string,
  /** App Store numeric id, for the apps that are on both stores. */
  appleId?: string
): CompanionApp {
  const androidPackage = `com.mohamedgado.${slug}`
  const app: CompanionApp = {
    slug,
    name,
    tagline,
    androidPackage,
    playStoreUrl: `https://play.google.com/store/apps/details?id=${androidPackage}`,
  }
  if (!appleId) return app
  return {
    ...app,
    appStoreUrl: `https://apps.apple.com/app/id${appleId}`,
    installUrl: `https://vette1123.github.io/${slug}-privacy/go`,
  }
}

export const COMPANION_APPS: CompanionApp[] = [
  companionApp(
    'rafiq',
    'Rafiq',
    'A private Islamic companion — prayer, Qur’an, adhkar, qibla',
    '6806678979'
  ),
  companionApp(
    'masareef',
    'Masareef',
    'An offline-first, multi-currency spending tracker',
    '6806735875'
  ),
  companionApp(
    'nafis',
    'Nafis',
    'A local-price tracker for gold, currencies and more'
  ),
]

/** Where an app can actually be installed from, for a row's hint text. */
export function storesLabel(app: CompanionApp): string {
  return app.appStoreUrl ? 'App Store · Google Play' : 'Google Play'
}

/**
 * The href to render on a real anchor: the chooser when there is one, so a
 * right-click, a copied link or a no-JS load all still reach both stores.
 */
export function storeHref(app: CompanionApp): string {
  return app.installUrl ?? app.playStoreUrl
}

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
 * Open an app's listing on the store the reader can actually install from.
 *
 * - Android: navigate to `market://` to launch the Play Store app, mirroring
 *   the apps' own deep-link behaviour. If nothing handles it (app missing) the
 *   page stays visible, so a short timeout falls back to the web listing. A
 *   successful hand-off hides the page, which cancels the fallback.
 * - iPhone / iPad: the App Store listing, or the Play listing for an
 *   Android-only app — there is nothing better to offer, and a listing that
 *   says "Android" beats a silent no-op.
 * - Desktop: the chooser page, which puts the reader's own store one tap away
 *   on whichever phone they open it on. A Play URL here dead-ended every
 *   iPhone.
 */
export function openStoreListing(app: CompanionApp): void {
  if (typeof window === 'undefined') return

  const ua = window.navigator.userAgent
  if (/android/i.test(ua)) {
    const fallback = window.setTimeout(() => {
      window.location.href = app.playStoreUrl
    }, 1200)

    const cancel = () => {
      window.clearTimeout(fallback)
      document.removeEventListener('visibilitychange', cancel)
    }
    document.addEventListener('visibilitychange', cancel)

    window.location.href = `market://details?id=${app.androidPackage}`
    return
  }

  const isApplePhone = /iPad|iPhone|iPod/.test(ua)
  const target = isApplePhone
    ? (app.appStoreUrl ?? app.playStoreUrl)
    : storeHref(app)
  window.open(target, '_blank', 'noopener,noreferrer')
}
