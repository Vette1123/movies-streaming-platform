// What we are allowed to do about ads inside a third-party <iframe>, and what
// we are not.
//
// We embed a streaming provider we do not control and which funds itself with
// advertising. A cross-origin iframe is opaque: we cannot inject CSS or JS into
// it, read or edit its DOM, or intercept the requests it makes. Our CSP does
// not apply inside it, and a service worker does not control it. So there is no
// way to delete an ad banner drawn inside the player, and any approach that
// claims to is not describing something a browser actually does.
//
// What we CAN control is every capability the frame uses to reach OUT of
// itself, which is where essentially all of the damage lives: popups and
// pop-unders, hijacking the tab to a different site, drive-by download prompts,
// alert() spam, and clipboard hijacking. Those are granted by the embedder, so
// they are ours to withhold. `sandbox` is enforced by the browser, applies to
// everything nested inside the frame (an ad iframe inside the player inherits
// it), and the frame cannot opt back out.
//
// Rule of thumb for what follows: grant a capability only if the video breaks
// without it.

/**
 * Permissions-Policy features whose DEFAULT allowlist is `*` — meaning a
 * cross-origin iframe gets them unless the embedder explicitly says no — and
 * which exist only to target and measure advertising.
 *
 * This is the part people miss. Most powerful features (camera, geolocation,
 * microphone) already default to `self`, so a cross-origin frame is denied
 * without us doing anything. The ad-tech APIs deliberately do not: Topics,
 * Attribution Reporting and Protected Audience are on for any embedded frame
 * that asks. Naming them with 'none' is the only way to switch them off.
 *
 * This does not stop an ad from rendering. It stops the frame from profiling
 * the viewer to choose which ad, and from reporting back that they saw it.
 */
const AD_TECH_DENIED = [
  'browsing-topics',
  'attribution-reporting',
  'join-ad-interest-group',
  'run-ad-auction',
  'interest-cohort',
]
  .map((feature) => `${feature} 'none'`)
  .join('; ')

/**
 * Builds an `allow` attribute: the features this particular frame genuinely
 * needs, followed by the ad-tech denials every frame gets.
 *
 * A function rather than one shared string because the three embeds need
 * genuinely different grants — an ambient background trailer has no use for
 * fullscreen or the clipboard — and the thing worth sharing is the denial list,
 * which is the part that must not drift.
 */
export const embedAllow = (features: string[]) =>
  `${features.join('; ')}; ${AD_TECH_DENIED}`

/**
 * The streaming embed: the four things a video player cannot work without.
 *
 * Dropped from what was here before: `clipboard-write`, the permission behind
 * clipboard-hijacking malvertising, which a player has no use for, and
 * `accelerometer` + `gyroscope`, motion-sensor fingerprinting surfaces that do
 * nothing for a video.
 */
export const STREAM_EMBED_ALLOW = embedAllow([
  'autoplay',
  'encrypted-media',
  'fullscreen',
  'picture-in-picture',
])

/**
 * The YouTube trailer dialog. YouTube is not going to pop-under anyone, so this
 * keeps the clipboard and `web-share` for the share button — but the ad-tech
 * denials apply here too, and the motion sensors go, because a trailer has no
 * more use for a gyroscope than a movie does.
 */
export const YOUTUBE_EMBED_ALLOW = embedAllow([
  'autoplay',
  'clipboard-write',
  'encrypted-media',
  'fullscreen',
  'picture-in-picture',
  'web-share',
])

/**
 * The muted ambient trailer behind the homepage hero. It is decorative and
 * driven entirely through postMessage, so it needs nothing beyond playback —
 * no fullscreen, no clipboard, no share.
 */
export const AMBIENT_TRAILER_ALLOW = embedAllow(['autoplay', 'encrypted-media'])

// DO NOT ADD A `sandbox` ATTRIBUTE TO THE STREAMING IFRAME. It is the obvious
// fix for popups and pop-unders, it is the first thing anyone reaches for, and
// it does not work here — it takes the player from "ads" to "no video at all".
//
// The provider detects it and refuses to load, rendering "This content can't be
// embedded in a sandboxed frame" in place of the player. Measured against the
// live embed on 2026-08-08, four configurations, same movie id:
//
//   no sandbox                                          plays
//   sandbox with EVERY token granted (allow-popups,
//     allow-top-navigation, allow-downloads, allow-modals, ...)   blocked
//   sandbox with popups allowed, only top-nav withheld           blocked
//
// Granting every capability still fails, which pins down what they check: the
// presence of the attribute, not any capability it withholds. So there is no
// token combination to find — the whole mechanism is unavailable, and this is
// deliberate on their side, because the popups are what pays for the embed.
//
// That means popups, pop-unders and tab-hijack redirects CANNOT be blocked from
// our side while we use a provider that mandates an unsandboxed frame. The only
// real fix is a provider that permits sandboxing; if one is ever adopted, the
// tokens to grant are `allow-scripts allow-same-origin allow-presentation` and
// nothing else, and note that allow-scripts + allow-same-origin together are
// only safe because the frame is cross-origin (a same-origin frame holding both
// can delete its own sandbox attribute).
//
// `pnpm embed:probe` screens a candidate provider for exactly this in about a
// minute — it renders the same URL sandboxed and unsandboxed side by side, with
// a YouTube positive control so a broken probe cannot be mistaken for a
// hostile provider. Both currently configured providers fail it.
//
// What the `allow` attribute above achieves is real and is not detected: no
// clipboard access, no motion sensors, and no Topics / Attribution Reporting /
// Protected Audience profiling. What it cannot touch is an ad drawn inside the
// player's own rectangle, which never leaves the frame.
