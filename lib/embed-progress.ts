// Progress events arriving over postMessage from an embedded player.
//
// The best embed on the list publishes the two things our position store
// needs — where playback stopped, and that it ended — as window messages to
// its parent. This turns those envelopes into the same writes our own house
// player makes, so continue-watching and resume work identically no matter
// which surface played. See lib/playback-positions.ts for the store, and
// components/player/reely-player.tsx for the same contract on the self-host
// side.
//
// Deliberately provider-shaped but provider-blind: nothing here names a host.
// The caller derives trust from the frame URL's origin and the message's
// source window (see the bridge component); this module only recognises
// envelope SHAPES.

export interface EmbedProgress {
  kind: 'progress' | 'ended'
  positionSeconds: number
  durationSeconds?: number
}

interface PlayerEventPayload {
  event?: unknown
  currentTime?: unknown
  duration?: unknown
}

/**
 * The payload rides under `data` OR under `event`, and which one depends
 * entirely on how many frames it has crossed.
 *
 * The provider's innermost player posts `{type:'PLAYER_EVENT', data:{…}}` to
 * the page that frames it. That page is theirs, and what it re-posts to ITS
 * own parent — us — is `{type:'PLAYER_EVENT', event:<the same payload>}`. Read
 * from their own bundle, and measured on 2026-09-06: an embed framed from
 * reely.space delivers the second shape and only the second shape, so a parser
 * that knew only `data` matched nothing that ever reached this origin. Every
 * position an embed reported was dropped on the floor, silently, because the
 * shape it was tested against is the one that never crosses a boundary.
 *
 * Accept both. They carry the same fields, the key is an artifact of depth,
 * and a recogniser that insists on one nesting depth is not recognising a
 * shape — it is guessing at a topology.
 */
interface PlayerEventEnvelope {
  type?: unknown
  data?: PlayerEventPayload
  event?: PlayerEventPayload
}

/** Player events that mean the title finished, across the two player families. */
const ENDED_EVENTS = new Set(['ended', 'complete'])

const finiteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null

/**
 * Recognise a progress-bearing message envelope, or null when the payload is
 * anything else (ads, analytics noise, other providers' chatter). A missing or
 * non-finite position disqualifies: a position we cannot store is not a
 * position.
 */
export const parseEmbedProgress = (data: unknown): EmbedProgress | null => {
  const envelope = data as PlayerEventEnvelope
  if (!envelope || envelope.type !== 'PLAYER_EVENT') return null
  const inner = envelope.data ?? envelope.event
  if (!inner || typeof inner !== 'object') return null

  if (typeof inner.event === 'string' && ENDED_EVENTS.has(inner.event))
    return { kind: 'ended', positionSeconds: 0 }

  if (inner.event !== 'timeupdate') return null
  const position = finiteNumber(inner.currentTime)
  if (position === null) return null
  const duration = finiteNumber(inner.duration)
  return {
    kind: 'progress',
    positionSeconds: position,
    ...(duration !== null && duration > 0 ? { durationSeconds: duration } : {}),
  }
}

/**
 * Throttle decision for position writes. Embed players emit timeupdate many
 * times a second; a position tick every few seconds would spam the sync
 * engine (see lib/playback-positions.ts on why these rows ride a longer
 * fuse). Write on the first report, then only after the reported position
 * has moved by MIN_WRITE_DELTA_SECONDS or jumped backwards (a seek).
 */
export const MIN_WRITE_DELTA_SECONDS = 5

export const shouldWriteEmbedProgress = (
  positionSeconds: number,
  lastWrittenSeconds: number | null
): boolean => {
  if (lastWrittenSeconds === null) return true
  return (
    Math.abs(positionSeconds - lastWrittenSeconds) >= MIN_WRITE_DELTA_SECONDS
  )
}
