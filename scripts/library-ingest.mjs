#!/usr/bin/env node
// Own-library ingest: one video file → HLS in D1 → playable on the site.
//
//   node scripts/library-ingest.mjs movie.mkv --ty movie --id 550 \
//     --title "Fight Club" [--site http://localhost:8788] [--cleanup] [--no-verify]
//
// What it does, in order, and what each step refuses:
//   1. transcodes the input to ONE 480p H.264 rendition, 6-second TS segments,
//      via ffmpeg (quality ladders want R2/B2 territory; on D1's 500 MB the
//      point of v1 is that it plays everywhere, cheaply)
//   2. deletes any previous tree for the unit (a re-ingest never leaves
//      orphaned chunks behind)
//   3. uploads every file in 1 MiB chunks — the platform cap on one BLOB row
//      is 2 MB — with retry + pacing, so a WAF rate limit costs seconds, not
//      the run
//   4. finalizes: file rows, then the playable row, ONE transaction — the unit
//      turns on atomically or not at all
//   5. verifies through the real serving route: manifest bytes, one segment
//      byte-for-byte, and a 206 Range slice — the same proof a viewer's
//      hls.js would pass
//   6. --cleanup deletes the unit after the proof (test runs)
//
// Needs LIBRARY_INGEST_TOKEN (+ LIBRARY_TOKEN_SECRET to self-verify) from the
// environment or .env.local, and ffmpeg on PATH.

import { spawnSync } from 'node:child_process'
import { createHash, createHmac } from 'node:crypto'
import { readFileSync, readdirSync, statSync, rmSync, mkdtempSync } from 'node:fs'
import { join, basename, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('..', import.meta.url))
const CHUNK = 1024 * 1024
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150 Safari/537.36'

// ---- args ------------------------------------------------------------------

const argv = process.argv.slice(2)
const arg = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}
const has = (name) => argv.includes(name)

const input = argv.find((a) => !a.startsWith('--'))
const ty = arg('--ty') ?? 'movie'
const id = Number(arg('--id'))
const s = arg('--s') ? Number(arg('--s')) : undefined
const ep = arg('--ep') ? Number(arg('--ep')) : undefined
const title = arg('--title')
const site = (arg('--site') ?? 'https://reely.space').replace(/\/$/, '')

const die = (msg) => {
  console.error(`ingest: ${msg}`)
  process.exit(1)
}
if (!input || !['movie', 'tv'].includes(ty)) {
  die('usage: library-ingest.mjs <video> --ty movie|tv --id N [--s N --ep N] [--title T]')
}
if (!Number.isInteger(id) || id < 1) die('--id must be a positive integer')
if (ty === 'tv' && (!Number.isInteger(s) || !Number.isInteger(ep)))
  die('--ty tv needs --s N --ep N')

// ---- env -------------------------------------------------------------------

const envOf = (name) => process.env[name] ?? envFile(name)
function envFile(name) {
  for (const line of readFileSync(join(REPO, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line)
    if (m && m[1] === name) return m[2].trim()
  }
  return undefined
}
const ingestKey = envOf('LIBRARY_INGEST_TOKEN')
const tokenSecret = envOf('LIBRARY_TOKEN_SECRET')
if (!ingestKey) die('LIBRARY_INGEST_TOKEN missing (set it in .env.local)')
if (has('--no-verify')) console.log('ingest: skipping self-verification (--no-verify)')
else if (!tokenSecret) die('LIBRARY_TOKEN_SECRET missing (needed to self-verify)')

// ---- media identity --------------------------------------------------------
//
// Must match lib/library-mode.ts exactly: the key the catalog and the play
// route are built from.
const mediaKey =
  ty === 'movie' ? `movie:${id}` : `tv:${id}:${s}:${ep}`
const prefix = ty === 'movie' ? `movie/${id}` : `tv/${id}/${s}-${ep}`

// ---- transcode -------------------------------------------------------------

const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
if (ffmpeg.error || ffmpeg.status !== 0) die('ffmpeg not found on PATH')
console.log(`ingest: ${ffmpeg.stdout.split('\n')[0].trim().slice(0, 80)}`)

const work = mkdtempSync(join(tmpdir(), 'reely-library-'))
const base = {
  ty: ty === 'movie' ? 'movie' : 'tv',
  id,
  ...(ty === 'tv' ? { s, ep } : {}),
  ...(title ? { title } : {}),
}
const commonVideo = [
  '-vf', 'scale=-2:480',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
  '-maxrate', '1500k', '-bufsize', '3000k',
  '-g', '48', '-keyint_min', '48', '-sc_threshold', '0',
  '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
  '-f', 'hls',
  '-hls_time', '6', '-hls_playlist_type', 'vod', '-hls_list_size', '0',
  '-hls_segment_filename', join(work, 'seg%04d.ts'),
]
let enc = spawnSync('ffmpeg', ['-y', '-i', resolve(input), ...commonVideo, join(work, 'master.m3u8')], {
  encoding: 'utf8',
})
if (enc.status !== 0) {
  // No audio stream (a silent rip, a dashcam clip): same video, -an.
  console.log('ingest: encode failed, retrying without audio')
  const noAudio = commonVideo.filter((a, i, arr) =>
    !(a === '-c:a' || a === '-b:a' || a === '-ac') &&
    !(a === 'aac' || a === '128k' || a === '2' && arr[i - 1] === '-ac')
  )
  enc = spawnSync('ffmpeg', ['-y', '-i', resolve(input), ...noAudio, '-an', join(work, 'master.m3u8')], {
    encoding: 'utf8',
  })
  if (enc.status !== 0) die(`ffmpeg encode failed:\n${(enc.stderr ?? '').split('\n').slice(-6).join('\n')}`)
}

const files = readdirSync(work)
  .filter((f) => f.endsWith('.m3u8') || f.endsWith('.ts'))
  .sort((a, b) => (a === 'master.m3u8' ? -1 : b === 'master.m3u8' ? 1 : a.localeCompare(b)))
if (!files.includes('master.m3u8')) die('transcode produced no master.m3u8')

const manifest = readFileSync(join(work, 'master.m3u8'), 'utf8')
for (const line of manifest.split('\n')) {
  if (line && !line.startsWith('#') && !files.includes(line.trim()))
    die(`playlist references "${line.trim()}" which was not produced`)
}

let total = 0
const plan = files.map((f) => {
  const buf = readFileSync(join(work, f))
  total += buf.length
  return {
    path: f,
    buf,
    sha: createHash('sha256').update(buf).digest('hex'),
    contentType:
      f.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
  }
})
const seconds = Number(manifest.match(/#EXT-X-TARGETDURATION:(\d+)/)?.[1] ?? 0)
console.log(
  `ingest: ${plan.length} files, ${(total / 1048576).toFixed(1)} MiB, ~${seconds}s target duration, key ${mediaKey}`
)
const DB_CAP = 500 * 1024 * 1024
if (total > DB_CAP * 0.9)
  die(
    `this unit is ${(total / 1048576).toFixed(0)} MiB — over 90% of a free-plan D1 database (500 MiB). Split it, or move this unit to R2/B2 first.`
  )

// ---- upload ----------------------------------------------------------------

const headers = {
  'x-library-key': ingestKey,
  'user-agent': BROWSER_UA,
  'content-type': 'application/json',
}
async function call(method, path, body) {
  const res = await fetch(`${site}/api/library/ingest${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (res.status === 429 || res.status >= 500)
    throw Object.assign(new Error(`HTTP ${res.status} ${json.error ?? ''}`), { retry: true })
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${json.error ?? ''}`), { retry: false })
  return json
}
async function callRetry(method, path, body) {
  for (let n = 0; ; n++) {
    try {
      return await call(method, path, body)
    } catch (e) {
      if (!e.retry || n >= 3) throw e
      const wait = 1000 * 2 ** n
      console.log(`ingest: ${e.message}, retry ${n + 1} in ${wait / 1000}s`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
}

// 1. Clear any previous tree for this unit.
const removed = await callRetry('DELETE', '', { media: mediaKey })
console.log(`ingest: cleared previous tree (${removed.removed?.join(' + ') ?? 'nothing'}) rows`)

// 2. Chunks, paced — a machine route, but a polite one.
const t0 = Date.now()
let chunkCount = 0
for (const f of plan) {
  const chunks = Math.ceil(f.buf.length / CHUNK)
  for (let seq = 0; seq < chunks; seq++) {
    const slice = f.buf.subarray(seq * CHUNK, Math.min(f.buf.length, (seq + 1) * CHUNK))
    await callRetry('PUT', '/file', {
      media: base,
      path: f.path,
      size: f.buf.length,
      seq,
      chunks,
      contentType: f.contentType,
      dataB64: slice.toString('base64'),
    })
    chunkCount++
    if (chunkCount % 20 === 0) console.log(`ingest: ${chunkCount} chunks…`)
    await new Promise((r) => setTimeout(r, 150))
  }
}

// 3. Finalize — one transaction turns the unit on.
await callRetry('POST', '/finalize', {
  media: base,
  durationS: seconds,
  files: plan.map((f) => ({
    path: f.path,
    contentType: f.contentType,
    size: f.buf.length,
    chunks: Math.ceil(f.buf.length / CHUNK),
  })),
})
console.log(
  `ingest: live — ${chunkCount} chunks in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${site}`
)

// ---- verify ----------------------------------------------------------------

const b64url = (bytes) =>
  Buffer.from(bytes).toString('base64url')
const libToken = (claims) => {
  const body = { k: 'l', ...claims, exp: Math.floor(Date.now() / 1000) + 600 }
  const json = b64url(Buffer.from(JSON.stringify(body), 'utf8'))
  const secret = Buffer.from(tokenSecret.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  return `${json}.${createHmac('sha256', secret).update(json).digest('base64url')}`
}

if (!has('--no-verify') && tokenSecret) {
  const token = libToken({ ty, id, ...(ty === 'tv' ? { s, ep } : {}) })
  const hlsBase = `${site}/api/library/hls/${token}/${prefix}`

  const manifestRes = await fetch(`${hlsBase}/master.m3u8`, {
    headers: { 'user-agent': BROWSER_UA },
  })
  const manifestBuf = Buffer.from(await manifestRes.arrayBuffer())
  const manifestSha = createHash('sha256').update(manifestBuf).digest('hex')
  const ok = manifestRes.status === 200 && manifestSha === plan[0].sha
  console.log(`verify: manifest ${manifestRes.status} sha ${ok ? 'MATCH' : 'MISMATCH'}`)
  if (!ok) die('manifest does not round-trip')

  const seg = plan.find((f) => f.path.endsWith('.ts'))
  if (seg) {
    const whole = await fetch(`${hlsBase}/${seg.path}`, { headers: { 'user-agent': BROWSER_UA } })
    const wholeBuf = Buffer.from(await whole.arrayBuffer())
    const wholeOk = whole.status === 200 && createHash('sha256').update(wholeBuf).digest('hex') === seg.sha
    console.log(`verify: segment ${whole.status} ${seg.path} sha ${wholeOk ? 'MATCH' : 'MISMATCH'}`)

    const mid = Math.floor(seg.buf.length / 2)
    const ranged = await fetch(`${hlsBase}/${seg.path}`, {
      headers: { 'user-agent': BROWSER_UA, range: `bytes=${mid}-${mid + 127}` },
    })
    const rangedBuf = Buffer.from(await ranged.arrayBuffer())
    const rangeOk =
      ranged.status === 206 &&
      rangedBuf.equals(seg.buf.subarray(mid, mid + 128)) &&
      ranged.headers.get('content-range') === `bytes ${mid}-${mid + 127}/${seg.buf.length}`
    console.log(`verify: range 206 slice ${rangeOk ? 'MATCH' : 'MISMATCH'}`)

    const tampered = `${token.slice(0, -2)}xx`
    const bad = await fetch(`${site}/api/library/hls/${tampered}/${prefix}/master.m3u8`, {
      headers: { 'user-agent': BROWSER_UA },
    })
    console.log(`verify: tampered token → ${bad.status} (want 403)`)
    const evil = await fetch(`${hlsBase}/%2e%2e/%2e%2e/%2e%2e/secret`, {
      headers: { 'user-agent': BROWSER_UA },
    })
    console.log(`verify: traversal (%2e%2e) → ${evil.status} (want 400 or 403)`)

    if (!wholeOk || !rangeOk || bad.status !== 403 || evil.status === 200)
      die('verification failed — the unit is up but not provably correct')
  }
}

console.log(
  `ingest: done. budget: ${(total / 1048576).toFixed(1)} MiB of a 500 MiB free-plan database (${((total / DB_CAP) * 100).toFixed(1)}%)`
)

if (has('--cleanup')) {
  await callRetry('DELETE', '', { media: mediaKey })
  console.log('ingest: cleaned up — unit deleted after the proof')
  rmSync(work, { recursive: true, force: true })
  process.exit(0)
}
console.log(`ingest: temp dir kept at ${work} (remove it yourself)`)
