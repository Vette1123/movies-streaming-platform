// The Reely brand mark, in one place.
//
// This used to be three hand-tuned copies of the same artwork: app/icon.tsx,
// app/apple-icon.tsx, and whatever produced the PNGs in public/. The static
// files had drifted so far they were blank gradients with no "R" in them at
// all, which is what a duplicated design eventually costs.
//
// The only consumer now is scripts/build-app-icons.mjs, which renders every
// target — favicon, Android, iOS, Windows tile — from this one definition at
// build time. The two metadata routes are gone: rasterizing this through
// Satori on the Worker burned CPU on every cold request for artwork that never
// changes. Every dimension below is a fraction of `size`, so a new target is
// one more entry in that script's TARGETS list.
//
// Underscore prefix keeps app/_icons out of the router, same as app/_og.

import { loadInter } from '../_fonts/load'

// Re-exported so scripts/build-app-icons.mjs gets the launch-screen table off
// the same esbuild bundle as the artwork. app/layout.tsx imports the table
// module directly instead — pulling it through here would drag the font loader
// into the client bundle.
export { APPLE_SPLASH } from './apple-splash'

export type MarkOptions = {
  size: number
  /** Corner rounding as a fraction of size. 0 for platforms that mask their
   *  own shape (iOS, Android maskable, Windows tiles) — rounding those twice
   *  leaves pale slivers in the corners. */
  radius?: number
  /** Glyph height as a fraction of size. Android's maskable safe zone is a
   *  centre circle of 80% diameter, so a mark drawn at the normal 0.78 loses
   *  its corners under a circular mask — see MASKABLE_GLYPH_SCALE. */
  glyphScale?: number
}

/** Fills the frame. Correct for anything that is NOT circle-masked. */
export const DEFAULT_GLYPH_SCALE = 0.78
/**
 * Corner rounding for apple-touch-icon, and the floor for everything else.
 *
 * 0.2237 is the exact ratio of Apple's squircle, and apple-touch-icon must not
 * exceed it: iOS clips that file to the squircle on the home screen, so a
 * rounder source gets bitten into by the mask and leaves transparent slivers at
 * the four corners. It must not go under it either — iOS *generates* a launch
 * screen from this same file when no apple-touch-startup-image matches, and
 * that generated screen does not mask, so a square icon shows up square there.
 * Matching the mask exactly is the only value that is right on both surfaces.
 */
export const DEFAULT_RADIUS = 0.2237
/**
 * Corner rounding for the targets nothing masks for us — the favicon and the
 * `purpose: "any"` manifest icons, which Chrome's desktop install prompt and
 * the Windows/Chrome OS shortcut it creates draw exactly as given.
 *
 * Deliberately rounder than the squircle above, because these are the sizes
 * where a squircle stops reading as one: at a 16px favicon, 0.2237 is a 3.6px
 * radius spread over ~2 antialiased pixels, which the eye resolves as a hard
 * square next to genuinely rounded tab icons. 0.30 gives 4.8px at 16 and
 * survives the downscale. Nothing masks these, so there is no sliver risk.
 */
export const SOFT_RADIUS = 0.3
/** Fits inside Android's 80% maskable safe zone with room for the descender. */
export const MASKABLE_GLYPH_SCALE = 0.52

export function brandMark({
  size,
  radius = 0,
  glyphScale = DEFAULT_GLYPH_SCALE,
}: MarkOptions) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter',
        position: 'relative',
        borderRadius: radius * size,
        overflow: 'hidden',
        backgroundImage:
          'linear-gradient(140deg, #2563eb 0%, #1d4ed8 45%, #0c1e4d 100%)',
      }}
    >
      {/* Top-left highlight and bottom-right shadow. Both are bled off the
          edge so the gradient reads as lit from one corner rather than as two
          visible circles. */}
      <div
        style={{
          position: 'absolute',
          top: -0.21 * size,
          left: -0.21 * size,
          width: 0.89 * size,
          height: 0.89 * size,
          background:
            'radial-gradient(circle, rgba(147,197,253,0.55), rgba(147,197,253,0) 65%)',
          display: 'flex',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -0.24 * size,
          right: -0.24 * size,
          width: 0.78 * size,
          height: 0.78 * size,
          background:
            'radial-gradient(circle, rgba(15,23,42,0.55), rgba(15,23,42,0) 65%)',
          display: 'flex',
        }}
      />
      <div
        style={{
          display: 'flex',
          fontSize: glyphScale * size,
          fontWeight: 900,
          color: 'transparent',
          backgroundImage:
            'linear-gradient(180deg, #ffffff 0%, #dbeafe 60%, #93c5fd 100%)',
          backgroundClip: 'text',
          letterSpacing: '-0.08em',
          lineHeight: 1,
          // Inter's cap height sits below the em box centre; nudge up so the R
          // is optically centred rather than mathematically centred.
          marginTop: -0.03 * size,
        }}
      >
        R
      </div>
    </div>
  )
}

/**
 * An iOS launch screen: the mark, centred, on the app's own background.
 *
 * Sized off the shorter axis so the same composition works in both
 * orientations, and rounded like the home-screen icon it launches from — this
 * is the frame the user stares at between tapping and first paint, so it
 * should look like the icon growing, not like a different asset.
 */
export function brandSplash({
  width,
  height,
}: {
  width: number
  height: number
}) {
  const mark = Math.round(Math.min(width, height) * 0.28)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: SPLASH_BACKGROUND,
      }}
    >
      <div style={{ display: 'flex', width: mark, height: mark }}>
        {brandMark({ size: mark, radius: DEFAULT_RADIUS })}
      </div>
    </div>
  )
}

/** Matches `background_color` in site.webmanifest and the app's own body. */
export const SPLASH_BACKGROUND = '#000000'

/** jsx + ImageResponse options, ready for `new ImageResponse(...)`. */
export async function buildIconInput(markOptions: MarkOptions) {
  return {
    jsx: brandMark(markOptions),
    options: await imageResponseOptions(markOptions.size, markOptions.size),
  }
}

/** Same, for an iOS launch screen at a given device resolution. */
export async function buildSplashInput(size: {
  width: number
  height: number
}) {
  return {
    jsx: brandSplash(size),
    options: await imageResponseOptions(size.width, size.height),
  }
}

async function imageResponseOptions(width: number, height: number) {
  const font = await loadInter(900, 'R')
  return {
    width,
    height,
    fonts: [
      {
        name: 'Inter',
        data: font,
        weight: 900 as const,
        style: 'normal' as const,
      },
    ],
  }
}
