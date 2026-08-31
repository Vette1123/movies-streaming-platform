/**
 * The one raised surface on the site.
 *
 * Panels were being drawn three different ways on the same screen: the account
 * overview cards used a white hairline over a 3% white fill with an inset
 * highlight, the settings switches used a bare `border` (which resolves to a
 * slate that all but vanishes against the page), and the supporter gate used a
 * dashed border over `bg-card/40`. Three recipes, one screen, and the settings
 * rows read as stray rectangles because their border was the only one in the
 * column and the weakest one on the page.
 *
 * This is the recipe that already worked, in one place. The site renders dark
 * only (`.light` exists in globals.css but nothing sets it), so a white hairline
 * is safe to state directly rather than behind a `dark:` variant.
 */
export const surface =
  'rounded-xl border border-white/10 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'

/** For a surface that is itself a button or a link. */
export const surfaceHover = 'hover:border-white/20 hover:bg-white/[0.06]'

/**
 * A hairline between rows inside one surface.
 *
 * Rows in a group are separated, not boxed: a border per row inside a bordered
 * group is two borders 1px apart, which is the "double frame" look.
 */
export const surfaceDivide = 'divide-y divide-white/[0.07]'
