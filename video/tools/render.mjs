// Renders both cuts at 60 fps and asserts what came out: frame rate, frame count and
// duration read back with ffprobe, so a film that silently dropped to 30 fps fails here.
//
//   pnpm build            -> out/smd-film-1080p60.mp4 and out/smd-reel-9x16-60.mp4
//   pnpm build Reel       -> only the compositions whose id contains "Reel"

import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PREFIX = process.env.FILM_PREFIX ?? 'reely'
const CUTS = [
  { id: 'Film', file: `${PREFIX}-film-1080p60.mp4`, w: 1920, h: 1080 },
  { id: 'Reel', file: `${PREFIX}-reel-9x16-60.mp4`, w: 1080, h: 1920 },
]
const FPS = 60
const FRAMES = 1560

const only = process.argv[2]
const todo = CUTS.filter((c) => !only || c.id.includes(only))
if (todo.length === 0) throw new Error(`No composition matches "${only}".`)
mkdirSync(join(ROOT, 'out'), { recursive: true })

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
let failed = 0
for (const cut of todo) {
  const out = join(ROOT, 'out', cut.file)
  console.log(`render ${cut.id} -> out/${cut.file}`)
  execFileSync(
    npx,
    [
      'remotion',
      'render',
      'src/index.ts',
      cut.id,
      out,
      '--codec=h264',
      '--crf=16',
      '--pixel-format=yuv420p',
      '--audio-codec=aac',
      '--audio-bitrate=256k',
      '--x264-preset=slow',
    ],
    { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' }
  )
  const probe = JSON.parse(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-count_frames',
      '-show_entries',
      'stream=width,height,r_frame_rate,nb_read_frames:format=duration',
      '-of',
      'json',
      out,
    ]).toString()
  )
  const s = probe.streams[0]
  const [n, d] = s.r_frame_rate.split('/').map(Number)
  const fps = n / d
  const frames = Number(s.nb_read_frames)
  const problems = []
  if (fps !== FPS) problems.push(`fps ${fps}, want ${FPS}`)
  if (frames !== FRAMES) problems.push(`frames ${frames}, want ${FRAMES}`)
  if (s.width !== cut.w || s.height !== cut.h)
    problems.push(`size ${s.width}x${s.height}, want ${cut.w}x${cut.h}`)
  if (problems.length) {
    failed++
    console.error(`FAIL ${cut.file}: ${problems.join('; ')}`)
  } else {
    console.log(
      `ok ${cut.file}: ${s.width}x${s.height} @ ${fps} fps, ${frames} frames, ${Number(probe.format.duration).toFixed(2)} s`
    )
  }
}
process.exit(failed ? 1 : 0)
