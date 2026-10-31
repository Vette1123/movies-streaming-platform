// Where you were on a page, so Back returns you there.
//
// Opening a title unmounts the page, and Back rebuilds it, so the hero slide and
// every rail started over. Only Back restores: the logo or a nav link starts the
// page fresh, which is the way to reset. Session-scoped because the place stops
// meaning anything once the content has moved on.
//
// ponytail: keyed by URL, not history entry, so A > B > A > C, back, back lands
// the first A on the second A's place. An entry id would mean writing into
// Next's history.state.

interface PagePlace {
  y: number
  rails: Record<string, number>
  slide?: number
}

const PREFIX = 'reely:place:'

let backPending = false

const currentPage = () => `${location.pathname}${location.search}`

function readPlace(page: string): PagePlace | null {
  try {
    const saved = sessionStorage.getItem(PREFIX + page)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function writePlace(page: string, place: PagePlace) {
  try {
    sessionStorage.setItem(PREFIX + page, JSON.stringify(place))
  } catch {
    // Private mode or a full quota: Back just starts the page over.
  }
}

export function pageKey() {
  return currentPage()
}

export function rememberPage(
  page: string,
  { y, rails }: Pick<PagePlace, 'y' | 'rails'>
) {
  const saved = readPlace(page)
  writePlace(page, { ...saved, y, rails: { ...saved?.rails, ...rails } })
}

export function rememberSlide(slide: number) {
  const page = currentPage()
  writePlace(page, { y: 0, rails: {}, ...readPlace(page), slide })
}

export function forgetPage() {
  try {
    sessionStorage.removeItem(PREFIX + currentPage())
  } catch {
    // Nothing was saved either.
  }
}

export function markBack() {
  backPending = true
}

export function settleBack() {
  backPending = false
}

export function isBackPending() {
  return backPending
}

export function restoredScroll() {
  return readPlace(currentPage())?.y ?? 0
}

// Only true for a client rebuild, never a hydration: the server always renders
// slide 0, which is also why a full-page Back keeps its scroll but not its slide.
export function restoredSlide(slideCount: number) {
  if (!backPending) return 0
  const slide = readPlace(currentPage())?.slide ?? 0
  return slide < slideCount ? slide : 0
}

export function restoredRail(rail: string) {
  if (!backPending) return 0
  return readPlace(currentPage())?.rails[rail] ?? 0
}
