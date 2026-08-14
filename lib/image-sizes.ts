// `sizes` strings for the images that are laid out with `object-cover`.
//
// The trap these exist for: `sizes` describes the box, but `object-cover`
// paints the IMAGE, and the two are only the same width while the box is wider
// than the image's own ratio. Once the box is TALLER than that — every phone in
// portrait, every full-height hero — cover scales the image up until its height
// fills the box and crops the sides. A hero on a 390x844 phone paints its 16:9
// backdrop 1500 CSS px wide, not 390, so `sizes="100vw"` under-describes it by
// a factor of four and the browser dutifully picks a candidate a quarter of the
// width it needs. That is what "the details page looks blurry" was: measured on
// a 2560px window, a 1080px file stretched across 2552 CSS px.
//
// So: name the height-driven width in `vh` for the tall case, and 100vw for the
// wide one. `vh` rather than `svh` because `sizes` is resolved by the preload
// scanner before layout — vh is the larger of the two, so this can only ever
// over-describe by the height of a mobile URL bar, never under-describe.
//
// The `(max-width: 640px)` brake in the backdrop string is a DELIBERATE
// under-ask, and the one place here that is not the honest number. A dpr-3
// phone doing the full cover math asks for 4506 px and lands on the top rung;
// measured on a hero backdrop, WebP from ImageKit:
//
//   w1200  31.7 KB   (what plain `100vw` picks today — 0.27 of what it paints)
//   w1920  76.0 KB   (what 160vw picks — 0.43)
//   w2560 112.4 KB   (the honest ask — 0.57, and 3.5x the bytes of today)
//
// 160vw takes the middle: 60% sharper than the current file for +44 KB, on the
// one image where under-sampling is least visible — a backdrop that is ~70%
// cropped away on a phone, sits under a scrim behind text, and (on the
// homepage) is mid-Ken-Burns. Above 640px there is no brake: tablets and
// desktops get the width they actually paint.
export const COVER_BACKDROP_SIZES =
  '(max-width: 640px) 160vw, (max-aspect-ratio: 16/9) 178vh, 100vw'

// Same geometry at the poster's 2:3, for the hero fallback that runs when a
// title has no backdrop at all. No brake needed: 67vh on a dpr-3 phone comes
// out at 1696 and lands on the 1920 rung by itself.
export const COVER_POSTER_SIZES = '(max-aspect-ratio: 2/3) 67vh, 100vw'
