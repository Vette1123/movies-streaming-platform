// The year hubs' range, on its own, because the Worker needs it too.
//
// It used to live in components/media/year-page.tsx, which pulls in React and
// every service that page renders from. lib/seo-facts.ts links a tail detail
// page to its year hub and must not link a year that has no page — but it is
// imported by cloudflare/worker.js, and dragging a component tree into the
// Worker bundle to read one number would be absurd.

/** Far enough back to be useful, near enough that TMDB's data is dense. */
export const FIRST_YEAR = 1990

export const yearRange = (): number[] => {
  const last = new Date().getFullYear()
  const years: number[] = []
  for (let year = last; year >= FIRST_YEAR; year--) years.push(year)
  return years
}

export const isValidYear = (value: string): boolean => {
  const year = Number(value)
  return (
    /^\d{4}$/.test(value) &&
    year >= FIRST_YEAR &&
    year <= new Date().getFullYear()
  )
}
