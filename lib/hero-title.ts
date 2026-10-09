// What the hero's title slot shows: the official wordmark, the plain text title,
// or (briefly) neither. Pure, so the rule is a test rather than a screenshot —
// see tests/hero-title.test.ts.
//
// The wordmark is NEVER gated on JavaScript. It used to sit at opacity-0 until
// React hydrated and flipped `logoLoaded`, then fade in over 700ms — so a logo
// the browser already had (it is preloaded and lands in ~150ms) stayed invisible
// for however long hydration took on that phone, plus the fade. An <img> paints
// itself the moment it decodes; the only thing JS decides is whether the TEXT
// fallback should be up.

export interface HeroTitleInput {
  /** A wordmark exists for this title. */
  hasLogo: boolean
  /** The wordmark has decoded (known only after hydration). */
  logoLoaded: boolean
  /** The wordmark failed to load. */
  logoError: boolean
  /** The trailer/logo lookup has resolved, so `hasLogo` is final. */
  extrasReady: boolean
  /** The first-paint grace period is over; a slow logo may be covered by text. */
  graceElapsed: boolean
}

export interface HeroTitleState {
  /** Render the wordmark <img>, visible as soon as the browser decodes it. */
  logo: boolean
  /** Show the plain-text title. */
  text: boolean
}

export function heroTitleState({
  hasLogo,
  logoLoaded,
  logoError,
  extrasReady,
  graceElapsed,
}: HeroTitleInput): HeroTitleState {
  const logo = hasLogo && !logoError
  if (!logo) {
    // No wordmark (or a broken one): the text is the title. Held back only
    // while it is still unknown whether a wordmark is coming at all.
    return { logo: false, text: extrasReady || graceElapsed }
  }
  // A wordmark is on its way. The text covers for it only once the grace is
  // over and it still has not arrived; the moment it decodes, the text goes.
  return { logo: true, text: graceElapsed && !logoLoaded }
}
