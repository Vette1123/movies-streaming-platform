/**
 * The film's clock. 60 fps on a 120 BPM grid: one beat is exactly 30 frames, so every
 * cut, hit and word lands on the soundtrack (tools/beat.mjs) with integer frames.
 */
export const FPS = 60
export const BPM = 120
export const BEAT = (FPS * 60) / BPM
export const BEATS = 52
export const DURATION = BEATS * BEAT

/** Frame of a beat. Fractions are allowed: b(5.5) is the off-beat. */
export const b = (beat: number) => Math.round(beat * BEAT)

/** The scenes, in beats. The soundtrack's hits are on 6 (drop), 36 (payoff), 42 (outro). */
export const SCENES = {
  hook: [0, 6],
  drop: [6, 10],
  discover: [10, 18],
  detail: [18, 26],
  track: [26, 36],
  promise: [36, 42],
  outro: [42, 52],
} as const satisfies Record<string, readonly [number, number]>

/** Frames a scene overlaps the next, so cuts cross instead of popping. */
export const CROSS = 12
