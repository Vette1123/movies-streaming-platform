// The pure half of `pnpm stream:order`: which env var holds what for a slot,
// and the rewrite of an env file's lines into a new slot order.

export const SLOTS = [1, 2, 3, 4, 5]
const FIELDS = ['LABEL', 'QUERY', 'MOVIE_PATH', 'TV_PATH']

const prefixOf = (slot) =>
  slot === 1
    ? 'NEXT_PUBLIC_STREAMING_MOVIES_API'
    : `NEXT_PUBLIC_STREAM_SOURCE_${slot}`

/** Every env var name a slot owns, keyed by field. Slot 1's URL has a suffix. */
export function slotVars(slot) {
  const url = slot === 1 ? `${prefixOf(1)}_URL` : prefixOf(slot)
  return {
    url,
    ...Object.fromEntries(FIELDS.map((f) => [f, `${prefixOf(slot)}_${f}`])),
  }
}

/** A permutation of 1-5, or an error message naming what was wrong. */
export function parseOrder(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b)
  if (sorted.join() !== SLOTS.join())
    return {
      error: `need a permutation of 1-5 (got: ${numbers.join(' ') || 'nothing'})`,
    }
  return { order: numbers }
}

const nameOf = (line) => line.slice(0, Math.max(0, line.indexOf('=')))

/**
 * Rewrite env lines so NEW slot i+1 holds what OLD slot order[i] held. Every
 * var of a slot moves together. Returns the new lines, plus `next`: each slot
 * var name to its new value (undefined = the slot no longer has it).
 */
export function reorderSlots(lines, order) {
  const valueOf = (name) => {
    const line = lines.find((l) => nameOf(l) === name)
    return line === undefined ? undefined : line.slice(name.length + 1)
  }
  // Snapshot every old slot before any new one is written.
  const old = Object.fromEntries(
    SLOTS.map((slot) => [
      slot,
      Object.fromEntries(
        Object.entries(slotVars(slot)).map(([k, name]) => [k, valueOf(name)])
      ),
    ])
  )
  const next = new Map()
  order.forEach((from, i) => {
    const target = slotVars(i + 1)
    for (const key of Object.keys(target)) next.set(target[key], old[from][key])
  })

  // The block goes where the first slot line was, so the file keeps its shape.
  const first = lines.findIndex((l) => next.has(nameOf(l)))
  const kept = lines.filter((l) => !next.has(nameOf(l)))
  const block = [...next].filter(([, v]) => v).map(([k, v]) => `${k}=${v}`)
  const at = first === -1 ? kept.length : first
  kept.splice(at, 0, ...block)
  return { lines: kept, next, old }
}
