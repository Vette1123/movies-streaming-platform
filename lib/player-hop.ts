// When the house player may be left behind, and what its reports may carry.
//
// An automatic hop exists for a stream that never started. On 2026-10-31 a
// stream that had played for nine minutes reported a dead end and Reely moved
// the viewer to another server in the same millisecond, with no word on screen,
// and saved that server for the title. The player now refuses to report that
// case, and this is the second lock: Reely judges from the progress it was sent
// itself, so a player bug cannot move somebody off a film they are watching.

/** Progress moved between two reports. A resume position alone proves nothing. */
export function playbackAdvanced(
  previous: number | undefined,
  next: number
): boolean {
  return previous !== undefined && next !== previous
}

export function mayLeavePlayer({
  sawPlayback,
  viewerChose,
}: {
  sawPlayback: boolean
  viewerChose: boolean
}): boolean {
  return viewerChose || !sawPlayback
}

/**
 * What the stall notice says. It only shows on a server that is still dead:
 * the first stall hops in the same tick, so after a hop it is the SECOND
 * server talking and nothing further will be tried. It used to promise
 * "Trying another" there, and then try nothing.
 */
export function stallNoticeText(autoHopped: boolean): string {
  return autoHopped
    ? 'Two servers did not respond'
    : 'This server is not responding'
}

/**
 * Only a pick by the viewer is saved. An automatic hop used to go down the same
 * path, so one bad boot replaced the Reely Player with Server 1 for that title
 * and, below supporter, for every title on the device and the account.
 */
export function isViewerChoice(via: 'switcher' | 'stall_auto'): boolean {
  return via === 'switcher'
}

export const INCIDENT_STEPS = [
  'stalled',
  'retry',
  'reload',
  'recovered',
  'stuck',
  'dead_on_boot',
] as const

export type IncidentStep = (typeof INCIDENT_STEPS)[number]

export interface PlayerIncident {
  step: IncidentStep
  hls_type?: string
  hls_details?: string
  http_status?: number
  played: boolean
  position_s?: number
  buffer_s?: number
  attempt?: number
  online?: boolean
}

const SHORT_WORD = /^[\w-]{1,48}$/

const word = (value: unknown): string | undefined =>
  typeof value === 'string' && SHORT_WORD.test(value) ? value : undefined

const count = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value)
    : undefined

const SKIP_SEGMENTS = ['intro', 'recap'] as const
const SKIP_ACTIONS = ['offered', 'tap', 'key', 'auto'] as const

/** A skip report from the player, or null for anything outside the two sets. */
export function skipReportFrom(data: Record<string, unknown>) {
  const segment = SKIP_SEGMENTS.find((known) => known === data.segment)
  const action = SKIP_ACTIONS.find((known) => known === data.how)
  return segment && action ? { segment, action } : null
}

/**
 * Enums and counts only, whatever arrives. The message comes from our own
 * origin, but this is what stands between a future field and PostHog: a stream
 * URL carries a provider host and a token, and this repository is public.
 */
export function incidentFrom(data: {
  step?: unknown
  hls_type?: unknown
  hls_details?: unknown
  http_status?: unknown
  played?: unknown
  position_s?: unknown
  buffer_s?: unknown
  attempt?: unknown
  online?: unknown
}): PlayerIncident | null {
  const step = INCIDENT_STEPS.find((known) => known === data.step)
  if (!step) return null
  return {
    step,
    hls_type: word(data.hls_type),
    hls_details: word(data.hls_details),
    http_status: count(data.http_status),
    played: data.played === true,
    position_s: count(data.position_s),
    buffer_s: count(data.buffer_s),
    attempt: count(data.attempt),
    online: typeof data.online === 'boolean' ? data.online : undefined,
  }
}
