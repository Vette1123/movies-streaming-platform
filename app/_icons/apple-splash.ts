// The iOS launch-screen table.
//
// Safari does not read `background_color` from the manifest — that field is
// Android's. An installed iOS PWA with no `apple-touch-startup-image` shows a
// white rectangle while it boots, which on a black-backgrounded app reads as a
// flash of the wrong app. The only fix Apple offers is a static image per
// device resolution, matched by media query.
//
// Deliberately data-only: no React, no font loading. app/layout.tsx imports
// this directly to emit the <link> tags, and app/_icons/source.tsx re-exports
// it so scripts/build-app-icons.mjs renders exactly the files those tags name.
// One table, so a tag can never point at a file the build didn't write.

/** [logical CSS width, logical CSS height, device pixel ratio] */
const DEVICES: Array<[number, number, number]> = [
  // iPhone. Several models share a resolution (the 12, 13 and 14 are all
  // 390x844@3, for instance) — the table is keyed by resolution, not model,
  // so one row covers all of them.
  //
  // A gap here is not cosmetic: with no matching image iOS generates its own
  // launch screen out of the apple-touch icon, so every missing row is a
  // device that gets the fallback instead of the real thing. Err toward
  // including a resolution.
  [320, 568, 2], // SE 1st gen / 5s
  [375, 667, 2], // 6 / 7 / 8, SE 2nd + 3rd
  [414, 736, 3], // 8 Plus
  [375, 812, 3], // X / XS / 11 Pro / 12 mini / 13 mini
  [414, 896, 2], // XR / 11
  [414, 896, 3], // XS Max / 11 Pro Max
  [390, 844, 3], // 12 / 12 Pro / 13 / 13 Pro / 14
  [428, 926, 3], // 12 Pro Max / 13 Pro Max / 14 Plus
  [393, 852, 3], // 14 Pro / 15 / 15 Pro / 16
  [430, 932, 3], // 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus
  [402, 874, 3], // 16 Pro
  [440, 956, 3], // 16 Pro Max
  // iPad.
  [744, 1133, 2], // mini 6th + 7th
  [768, 1024, 2], // mini 5th / 9.7"
  [810, 1080, 2], // 10.2"
  [820, 1180, 2], // Air 10.9" / 11", iPad 10th
  [834, 1112, 2], // 10.5"
  [834, 1194, 2], // Pro 11" (1st–4th gen)
  [834, 1210, 2], // Pro 11" M4
  [1024, 1366, 2], // Pro 12.9", Air 13"
  [1032, 1376, 2], // Pro 13" M4
]

export type AppleSplash = {
  /** Path under public/, and the href in the <link>. */
  file: string
  /** Rendered pixel width/height — the logical size times the pixel ratio. */
  width: number
  height: number
  /** The media query iOS matches to pick this image. */
  media: string
}

/**
 * One entry per device per orientation. Landscape is the portrait entry with
 * the axes swapped — iOS will not rotate a portrait image to fit, it just
 * falls back to white.
 */
export const APPLE_SPLASH: AppleSplash[] = DEVICES.flatMap(([w, h, ratio]) => {
  const base = `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${ratio})`
  return [
    {
      file: `/splash/apple-splash-${w * ratio}x${h * ratio}.png`,
      width: w * ratio,
      height: h * ratio,
      media: `${base} and (orientation: portrait)`,
    },
    {
      file: `/splash/apple-splash-${h * ratio}x${w * ratio}.png`,
      width: h * ratio,
      height: w * ratio,
      media: `${base} and (orientation: landscape)`,
    },
  ]
})
