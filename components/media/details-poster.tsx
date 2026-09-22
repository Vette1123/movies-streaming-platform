import React from 'react'

import { cn, getImageURL } from '@/lib/utils'
import { BlurredImage, POSTER_QUALITY } from '@/components/blurred-image'

// The big poster beside the synopsis on a details page. Movies and series had
// byte-identical copies of this block, so it lives here once — a fix to either
// the box or the image can no longer land on one page and miss the other.
//
// Two things it does differently from the copies it replaces:
//
//   - `original`, not the w500 poster path. The box is 400 CSS px wide at lg,
//     which a dpr-2 laptop paints at 800 device px — the 500px source could
//     only be stretched to reach it. The loader still asks ImageKit for exactly
//     the width the layout needs (and `c-at_max` never enlarges), so a bigger
//     source costs nothing anywhere; it only stops the ceiling being 500.
//   - `quality={POSTER_QUALITY}`. Going through BlurredImage's `intro` branch
//     had it inherit the 65 tuned for backdrops — full-bleed photos that live
//     under a scrim behind text. This is the opposite: a small, dense image
//     with a title treatment, sitting still, that someone is looking straight
//     at.
//
// `sizes` names all three boxes the wrapper actually has (220 / 260 / 400),
// where the old string claimed 260 down to zero width.
const POSTER_SIZES =
  '(min-width: 1024px) 400px, (min-width: 640px) 260px, 220px'

/**
 * The breakpoint at which the poster stops being a centred block stacked above
 * the information and joins it on a single row.
 *
 * It lives here, beside the poster, because THREE class strings have to agree
 * about it and they were each written out separately: the row on the movie
 * page, the same row on the series page, and the poster's own `mx-auto`
 * centring below. All three said `lg` — 1024px — so at a tablet width a 260px
 * poster sat marooned in the middle of a ~900px row with a few hundred pixels
 * of inert gutter either side of it, and the synopsis began underneath. PostHog
 * logged the clicks that landed in that gutter: they hit the row itself, which
 * is layout, so nothing happened. From `md` the poster and the copy fill the
 * row between them and the gutter does not exist.
 *
 * Callers add their own stacking direction for the narrow case — the movie page
 * puts the poster first, the series page puts the synopsis first and the poster
 * after it (`order-*` on each child; see components/series/details-content.tsx)
 * — and both resolve to the same row here.
 *
 * `md:flex-wrap` is what lets ONE constant serve both pages, which have a
 * different number of columns. The movie row is poster + information and never
 * wraps. The series row has a third child, the season navigator, and that aside
 * is `w-full` until `lg` — dropped into a row at `md` unwrapped it would claim
 * the whole line and crush the synopsis to about 90px. Wrapping, it takes its
 * own line under the poster and the copy until `xl` makes it a real column (see
 * NAVIGATOR_BOX in components/series/season-navigator.tsx), at which point all
 * three fit against a 1208px container and the line stops breaking on its own.
 *
 * The information column must be `flex-1` (i.e. `flex: 1 1 0%`) for that to be
 * deterministic: a zero flex-basis means it never contributes width to the
 * wrapping decision, so where the line breaks depends only on the poster and the
 * aside, not on how long a synopsis happens to be.
 *
 * Wrapping is scoped to `md` and up on purpose — below it the container is a
 * COLUMN, where `flex-wrap` would break on height instead.
 */
export const DETAILS_ROW = 'flex gap-8 md:flex-row md:flex-wrap'

export const DetailsPoster = ({
  path,
  alt,
  className,
}: {
  path: string
  alt: string
  /** Order/stack overrides — the series page resequences this box on mobile. */
  className?: string
}) => (
  <div
    className={cn(
      'mx-auto w-full max-w-55 shrink-0 sm:max-w-65 md:mx-0 lg:w-100 lg:max-w-none',
      className
    )}
  >
    <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl shadow-xl lg:aspect-auto lg:min-h-150">
      <BlurredImage
        src={getImageURL(path)}
        alt={alt}
        className="size-full object-cover"
        fill
        sizes={POSTER_SIZES}
        quality={POSTER_QUALITY}
        intro
      />
    </div>
  </div>
)
