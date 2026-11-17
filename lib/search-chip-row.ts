export type ChipRow = 'shown' | 'reserved' | 'none'

/**
 * Whether the All / Movies / TV chip row takes room above the result list.
 *
 * The row used to exist only while results were showing, so every keystroke
 * (results -> loading -> results) removed and re-added 41px and the whole list
 * jumped: field CLS 0.6-4.9 on /movies for anyone who searched. The row now
 * keeps its space (`reserved`, drawn invisible) in every state that can lead to
 * results, and only a settled search with nothing to filter drops it.
 */
export function chipRowState(
  status: 'idle' | 'loading' | 'empty' | 'link' | 'failed' | 'results',
  resultCount: number
): ChipRow {
  if (status === 'results' && resultCount > 0) return 'shown'
  if (status === 'idle' || status === 'loading' || status === 'results')
    return 'reserved'
  return 'none'
}
