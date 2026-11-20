// The soundtrack, synthesised sample by sample: nothing to license, the same file every
// run (seeded PRNG). Adapted from Masareef's ad beat (masareef-app/video/tools/beat.mjs).
//
// One grid for every film here: 120 BPM, 52 beats, 26 s. At 60 fps a beat is exactly 30
// frames, so src/timing.ts can cut on beats with integer frames.
//   beats 0-6   the problem; a riser, then 240 ms of silence
//   beat 6      the drop (the product's first frame)
//   beats 6-42  the groove; the arpeggio joins at 14, the payoff hit lands on 36
//   beat 42     the outro hit; half time, resolves on C
//
//   node tools/beat.mjs smd     -> public/audio/beat-smd.wav
//   node tools/beat.mjs reely   -> public/audio/beat-reely.wav

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STORY = process.argv[2] ?? 'smd'

const SR = 48000
const BPM = 120
const B = 60 / BPM
const BEATS = 52
const N = Math.ceil(BEATS * B * SR)

// Buses. Drums play straight; the music bus is ducked by every kick (the pump); the send
// feeds one shared reverb; the echo bus feeds a ping-pong delay.
const dL = new Float32Array(N),
  dR = new Float32Array(N)
const mL = new Float32Array(N),
  mR = new Float32Array(N)
const send = new Float32Array(N)
const echo = new Float32Array(N)
const duck = new Float32Array(N).fill(1)

let seed = 0x9e3779b9
const rand = () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const noise = () => rand() * 2 - 1
const at = (beat) => Math.round(beat * B * SR)
const coef = (hz) => 1 - Math.exp((-2 * Math.PI * hz) / SR)
const TAU = 2 * Math.PI

/** Render `len` seconds of `fn(t)` into a bus pair from `beat`, with pan and sends. */
function put(
  busL,
  busR,
  beat,
  len,
  fn,
  { gain = 1, pan = 0, rev = 0, dly = 0 } = {}
) {
  const s = at(beat)
  const gl = gain * Math.min(1, 1 - pan),
    gr = gain * Math.min(1, 1 + pan)
  const n = Math.round(len * SR)
  for (let i = 0; i < n && s + i < N; i++) {
    const v = fn(i / SR)
    busL[s + i] += v * gl
    busR[s + i] += v * gr
    if (rev) send[s + i] += v * gain * rev
    if (dly) echo[s + i] += v * gain * dly
  }
}

const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12)
// Pad voicings and bass roots, as MIDI notes.
const CHORD = {
  Am: { pad: [57, 60, 64, 69], bass: 45 },
  F: { pad: [53, 57, 60, 65], bass: 41 },
  C: { pad: [55, 60, 64, 67], bass: 48 },
  G: { pad: [55, 59, 62, 67], bass: 43 },
}
/**
 * Per story: [start beat, chord] runs until the next one, and the arpeggio's note order.
 * The cadence into the outro (F G C on 38-42) is shared, so every ad lands the same way.
 */
const VARIANTS = {
  // Bright and driving: the drop is the link resolving.
  smd: {
    progression: [
      [0, 'Am'],
      [6, 'C'],
      [10, 'G'],
      [14, 'Am'],
      [18, 'F'],
      [22, 'C'],
      [26, 'G'],
      [30, 'Am'],
      [34, 'F'],
      [38, 'F'],
      [40, 'G'],
      [42, 'C'],
      [46, 'F'],
      [50, 'C'],
    ],
    arp: [0, 2, 1, 3, 0, 2, 3, 1],
  },
  // Wider and moodier, a trailer's minor turn before it opens up.
  reely: {
    progression: [
      [0, 'Am'],
      [6, 'F'],
      [10, 'C'],
      [14, 'G'],
      [18, 'Am'],
      [22, 'F'],
      [26, 'G'],
      [30, 'C'],
      [34, 'G'],
      [38, 'F'],
      [40, 'G'],
      [42, 'C'],
      [46, 'F'],
      [50, 'C'],
    ],
    arp: [0, 1, 2, 3, 2, 1, 2, 3],
  },
}
const VARIANT = VARIANTS[STORY]
if (!VARIANT)
  throw new Error(
    `beat.mjs: no story "${STORY}" — known: ${Object.keys(VARIANTS).join(' ')}`
  )
const PROGRESSION = VARIANT.progression
const OUT = resolve(ROOT, `public/audio/beat-${STORY}.wav`)
const chordAt = (beat) => {
  let name = PROGRESSION[0][1]
  for (const [b, c] of PROGRESSION) if (beat >= b) name = c
  return CHORD[name]
}

// --- voices -----------------------------------------------------------------

function kick(beat, gain = 0.95, muffle = 0) {
  let ph = 0,
    lp = 0
  const a = muffle ? coef(muffle) : 0
  put(
    dL,
    dR,
    beat,
    0.42,
    (t) => {
      ph += (TAU * (46 + 120 * Math.exp(-t * 30))) / SR
      let v = Math.tanh(
        1.6 *
          (Math.sin(ph) * Math.exp(-t * 6.5) +
            noise() * Math.exp(-t * 400) * 0.25)
      )
      if (a) {
        lp += a * (v - lp)
        v = lp
      }
      return v
    },
    { gain }
  )
  // The pump: the music bus ducks under every kick and swells back.
  const s = at(beat)
  for (let i = 0; i < 0.32 * SR && s + i < N; i++) {
    duck[s + i] = Math.min(duck[s + i], 1 - 0.72 * Math.exp(-(i / SR) * 8))
  }
}

function clap(beat, gain = 0.42) {
  // Band-passed noise: three fast bursts and a short tail.
  const w = (TAU * 1150) / SR,
    q = 1.1,
    al = Math.sin(w) / (2 * q),
    a0 = 1 + al
  const b0 = al / a0,
    b2 = -al / a0,
    a1 = (-2 * Math.cos(w)) / a0,
    a2 = (1 - al) / a0
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0
  put(
    dL,
    dR,
    beat,
    0.32,
    (t) => {
      let env = 0
      for (let k = 0; k < 3; k++)
        if (t >= k * 0.011) env += Math.exp(-(t - k * 0.011) * 190)
      if (t >= 0.033) env += 0.85 * Math.exp(-(t - 0.033) * 15)
      const x = noise() * env
      const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2
      x2 = x1
      x1 = x
      y2 = y1
      y1 = y
      return y * 3
    },
    { gain, rev: 0.35 }
  )
}

function hat(beat, gain = 0.16, open = false, pan = 0.15) {
  let l1 = 0,
    l2 = 0
  const a = coef(7000)
  put(
    dL,
    dR,
    beat,
    open ? 0.32 : 0.07,
    (t) => {
      const x = noise()
      l1 += a * (x - l1)
      const h = x - l1
      l2 += a * (h - l2)
      return (h - l2) * Math.exp(-t * (open ? 11 : 60))
    },
    { gain, pan }
  )
}

function crash(beat, gain = 0.26) {
  for (const pan of [-0.6, 0.6]) {
    let l1 = 0,
      l2 = 0
    const a = coef(4200)
    put(
      dL,
      dR,
      beat,
      2.4,
      (t) => {
        const x = noise()
        l1 += a * (x - l1)
        const h = x - l1
        l2 += a * (h - l2)
        return (h - l2) * Math.exp(-t * 1.7)
      },
      { gain, pan, rev: 0.2 }
    )
  }
}

function impact(beat, gain = 0.8) {
  let ph = 0
  put(
    dL,
    dR,
    beat,
    1.4,
    (t) => {
      ph += (TAU * (32 + 50 * Math.exp(-t * 3))) / SR
      return Math.tanh(1.4 * Math.sin(ph)) * Math.exp(-t * 2.4)
    },
    { gain }
  )
  kick(beat, 1)
  crash(beat, 0.3)
}

function tick(beat, hi) {
  const f = hi ? 2600 : 1900
  put(
    dL,
    dR,
    beat,
    0.06,
    (t) => (Math.sin(TAU * f * t) + noise() * 0.3) * Math.exp(-t * 95),
    {
      gain: 0.2,
      pan: hi ? 0.25 : -0.25,
      rev: 0.15,
    }
  )
}

/** Saw-ish additive pad: `bright` is how many harmonics it keeps. Sidechained. */
function pad(
  from,
  to,
  notes,
  { gain = 0.09, bright = 2.4, attack = 0.25 } = {}
) {
  const len = (to - from) * B + 0.35
  for (const [i, m] of notes.entries()) {
    for (const det of [-0.0035, 0.0035]) {
      const f = hz(m) * (1 + det)
      put(
        mL,
        mR,
        from,
        len,
        (t) => {
          let v = 0
          for (let k = 1; k <= 9; k++)
            v += (Math.sin(TAU * f * k * t) / k) * Math.exp(-k / bright)
          const env =
            Math.min(1, t / attack) * Math.min(1, Math.max(0, (len - t) / 0.35))
          return v * env
        },
        {
          gain: gain / notes.length,
          pan: det < 0 ? -0.5 : 0.5,
          rev: 0.25 + i * 0.02,
        }
      )
    }
  }
}

function bass(beat, midi, gain = 0.34) {
  const f = hz(midi)
  put(
    mL,
    mR,
    beat,
    0.24,
    (t) => {
      const v = Math.sin(TAU * f * t) + 0.35 * Math.sin(TAU * 2 * f * t)
      // Saturated so the 2nd and 3rd harmonics carry it on a phone speaker.
      return Math.tanh(1.8 * v) * Math.min(1, t / 0.004) * Math.exp(-t * 6)
    },
    { gain }
  )
}

function pluck(beat, midi, gain = 0.07, pan = 0) {
  const f = hz(midi)
  put(
    mL,
    mR,
    beat,
    0.32,
    (t) => {
      const v =
        Math.sin(TAU * f * t) +
        0.45 * Math.sin(TAU * 2 * f * t) +
        0.15 * Math.sin(TAU * 3 * f * t)
      return v * Math.min(1, t / 0.002) * Math.exp(-t * 15)
    },
    { gain, pan, rev: 0.25, dly: 0.5 }
  )
}

function riser(from, to, gain = 0.2) {
  const len = (to - from) * B
  let lp = 0,
    ph = 0
  put(
    dL,
    dR,
    from,
    len,
    (t) => {
      const u = t / len
      lp += coef(300 * Math.pow(33, u)) * (noise() - lp)
      ph += (TAU * (180 + 900 * u * u)) / SR
      return (lp * 1.6 + 0.25 * Math.sin(ph)) * u * u
    },
    { gain, rev: 0.3 }
  )
}

/** A tone sliding from f0 to f1 Hz through the hook: the salary draining, or spend climbing. */
function slideTone(from, to, f0 = 520, f1 = 110) {
  const len = (to - from) * B
  let ph = 0
  put(
    mL,
    mR,
    from,
    len,
    (t) => {
      const u = t / len
      ph +=
        (TAU *
          (f0 * Math.pow(f1 / f0, u) * (1 + 0.01 * Math.sin(TAU * 6 * t)))) /
        SR
      return Math.sin(ph) * Math.sin(Math.PI * Math.min(1, u * 1.15))
    },
    { gain: 0.07, rev: 0.4 }
  )
}

/** The missing entries: an eighth-note pluck on the chord that drops every third note. */
function stutter(from, to) {
  const notes = CHORD.Am.pad
  for (let s = from * 2; s < to * 2; s++) {
    if (s % 3 === 2) continue
    pluck(s / 2, notes[s % notes.length] + 12, 0.06, s % 2 ? 0.35 : -0.35)
  }
}

// --- the arrangement --------------------------------------------------------

// The bad month.
for (let b = 0; b < 6; b++) {
  tick(b, b % 2 === 0)
  kick(b, 0.55, 160)
}
pad(0, 6, CHORD.Am.pad, { gain: 0.11, bright: 1.1, attack: 0.6 })
const HOOKS = {
  // A save that keeps failing: a pluck that keeps dropping notes.
  smd: () => stutter(1, 5.5),
  // Scrolling and scrolling: a tone that sinks the whole intro.
  reely: () => slideTone(0.6, 5.4),
}
HOOKS[STORY]()
riser(3, 6)

// The drop.
impact(6)

// The groove.
for (let b = 6; b < 42; b++) {
  const inBar = (b - 6) % 4
  kick(b)
  const roll = b === 35
  if (roll) {
    for (const s of [0, 0.25, 0.5, 0.75]) clap(b + s, 0.2 + s * 0.35)
  } else if ((b - 6) % 2 === 1) {
    clap(b)
  }
  hat(b + 0.5, 0.15, inBar === 3 || b >= 38)
  hat(b + 0.25, 0.045, false, -0.2)
  hat(b + 0.75, 0.045, false, -0.2)
  bass(b + 0.5, chordAt(b).bass)
}
for (let i = 1; i < PROGRESSION.length; i++) {
  const [from, name] = PROGRESSION[i]
  if (from < 6 || from >= 42) continue
  const to = PROGRESSION[i + 1]?.[0] ?? 42
  pad(from, to, CHORD[name].pad, { gain: 0.15, bright: 3 })
}

// The arpeggio joins once the "how" starts, and opens up after the payoff.
const ARP = VARIANT.arp
for (let s = 14 * 4; s < 42 * 4; s++) {
  const beat = s / 4
  const notes = chordAt(beat).pad
  const m = notes[ARP[s % ARP.length] % notes.length] + 12
  pluck(beat, m, beat >= 36 ? 0.11 : 0.08, s % 2 ? 0.3 : -0.3)
}
riser(34, 36, 0.14)
crash(36, 0.24)
kick(36, 1)

// The outro: hit, half-time, resolve.
impact(42)
for (const b of [44, 46, 48]) kick(b, 0.75)
for (const b of [45, 47]) clap(b, 0.32)
pad(42, 46, CHORD.C.pad, { gain: 0.11, bright: 3 })
pad(46, 50, CHORD.F.pad, { gain: 0.1, bright: 2.6 })
pad(50, 52, CHORD.C.pad, { gain: 0.1, bright: 2.2, attack: 0.05 })
for (let s = 42 * 2; s < 50 * 2; s++) {
  const beat = s / 2
  const notes = chordAt(beat).pad
  pluck(
    beat,
    notes[ARP[s % ARP.length] % notes.length] + 12,
    0.07,
    s % 2 ? 0.3 : -0.3
  )
}
for (const [i, m] of CHORD.C.pad.entries()) pluck(50 + i * 0.06, m + 12, 0.09)

// --- effects and the master ---------------------------------------------------

/** Ping-pong delay, dotted eighth, onto the music bus. */
{
  const d = Math.round(0.75 * B * SR)
  const bl = new Float32Array(N),
    br = new Float32Array(N)
  for (let i = 0; i < N; i++) {
    const inL = i >= d ? echo[i - d] + br[i - d] * 0.38 : 0
    const inR = i >= d ? bl[i - d] * 0.38 : 0
    bl[i] = inL
    br[i] = inR
    mL[i] += inL * 0.55
    mR[i] += inR * 0.55
  }
}

/** Schroeder reverb: four combs and two allpasses per side, from the shared send. */
function reverb(combs, alls) {
  const out = new Float32Array(N)
  for (const len of combs) {
    const buf = new Float32Array(len)
    let p = 0,
      lp = 0
    for (let i = 0; i < N; i++) {
      const y = buf[p]
      lp += 0.42 * (y - lp)
      buf[p] = send[i] + lp * 0.8
      out[i] += y
      p = (p + 1) % len
    }
  }
  for (const len of alls) {
    const buf = new Float32Array(len)
    let p = 0
    for (let i = 0; i < N; i++) {
      const b = buf[p]
      const y = -out[i] + b
      buf[p] = out[i] + b * 0.5
      out[i] = y
      p = (p + 1) % len
    }
  }
  return out
}
const rvL = reverb([1693, 1759, 1623, 1548], [245, 605])
const rvR = reverb([1721, 1787, 1651, 1576], [271, 631])

const outL = new Float32Array(N),
  outR = new Float32Array(N)
const gap = [at(5.76), at(6)]
for (let i = 0; i < N; i++) {
  let l = dL[i] + mL[i] * duck[i] + rvL[i] * 0.16
  let r = dR[i] + mR[i] * duck[i] + rvR[i] * 0.16
  // The breath before the drop.
  if (i >= gap[0] && i < gap[1]) {
    const g = Math.max(0, 1 - (i - gap[0]) / (0.012 * SR))
    l *= g
    r *= g
  }
  outL[i] = l
  outR[i] = r
}
// Glue: a soft clip that only ever bends the loudest transients. The drive is set off
// the measured peak, so it bends the same amount however the voices above are levelled
// (a fixed drive flattened every kick the first time).
let raw = 0
for (let i = 0; i < N; i++)
  raw = Math.max(raw, Math.abs(outL[i]), Math.abs(outR[i]))
const DRIVE = 1.25
for (let i = 0; i < N; i++) {
  outL[i] = Math.tanh((outL[i] / raw) * DRIVE)
  outR[i] = Math.tanh((outR[i] / raw) * DRIVE)
}
// The last 0.4s fades so a looping Reel does not click back to the hook.
for (let i = N - Math.round(0.4 * SR); i < N; i++) {
  const g = (N - i) / (0.4 * SR)
  outL[i] *= g
  outR[i] *= g
}

let peak = 0
for (let i = 0; i < N; i++)
  peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]))
if (!(peak > 0.05))
  throw new Error(
    `beat.mjs: the mix peaked at ${peak} — something rendered silent`
  )
const norm = 0.89 / peak

const data = Buffer.alloc(44 + N * 4)
data.write('RIFF', 0)
data.writeUInt32LE(36 + N * 4, 4)
data.write('WAVE', 8)
data.write('fmt ', 12)
data.writeUInt32LE(16, 16)
data.writeUInt16LE(1, 20)
data.writeUInt16LE(2, 22)
data.writeUInt32LE(SR, 24)
data.writeUInt32LE(SR * 4, 28)
data.writeUInt16LE(4, 32)
data.writeUInt16LE(16, 34)
data.write('data', 36)
data.writeUInt32LE(N * 4, 40)
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(outL[i] * norm * 32767), 44 + i * 4)
  data.writeInt16LE(Math.round(outR[i] * norm * 32767), 46 + i * 4)
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, data)
console.log(
  `  ✓ beat-${STORY}.wav — ${BEATS} beats at ${BPM} BPM, ${(N / SR).toFixed(2)}s, peak ${peak.toFixed(2)} -> -1 dBFS`
)
