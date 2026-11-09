// Which people get a /person/<id> page — the union rules behind
// `pnpm people:refresh`, kept pure so they can be tested.
//
// Three sources, in priority order:
//   1. the people already shipped: they keep their pages, always;
//   2. ids named by hand: pages Google already holds (the 404 report), so
//      they are promises, and the soft budget does not get to refuse them;
//   3. the catalogue's cast and crew: new pages, only while the budget lasts.
//
// The hand-named ids used to go in after the catalogue and then through the
// same `slice(0, cap)`, so once the file sat at the cap they were dropped in
// silence — on 2026-11-09 the cap was 760 against 764 shipped, and every one
// of the 44 person 404s in Search Console would have been thrown away.

/**
 * @template {{ id: number }} P
 * @param {{ existing: P[], manual: P[], ranked: P[], cap: number }} input
 * @returns {P[]}
 */
export function mergePeople({ existing, manual, ranked, cap }) {
  const byId = new Map(existing.map((person) => [person.id, person]))
  for (const person of manual) {
    if (!byId.has(person.id)) byId.set(person.id, person)
  }
  for (const person of ranked) {
    if (byId.size >= cap) break
    if (!byId.has(person.id)) byId.set(person.id, person)
  }
  return [...byId.values()]
}

/**
 * How many people the file budget leaves room for.
 *
 * With no `out/` to measure there is no way to know what the rest of the site
 * costs, and the old fallback (the whole target spent on people) would have
 * let the catalogue add ~2,000 pages to a site already at 18,000 files. Blind,
 * the set does not grow from the catalogue at all.
 */
export function peopleCap({
  before,
  totalFiles,
  personFiles,
  target,
  perPerson,
}) {
  if (totalFiles === null) return before
  const others = totalFiles - (personFiles ?? 0)
  return Math.max(before, Math.floor((target - others) / perPerson))
}
