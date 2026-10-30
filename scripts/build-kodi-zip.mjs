#!/usr/bin/env node
// Zips the committed add-on into public/, where /link offers it for download.
// `git archive` because Node has no zip writer and Kodi wants the add-on's
// folder as the top level of the zip; `--prefix` is what puts it there.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'

const FOLDER = 'kodi/plugin.video.reely'
const OUTPUT = 'public/kodi/plugin.video.reely.zip'

fs.mkdirSync('public/kodi', { recursive: true })
const result = spawnSync(
  'git',
  [
    'archive',
    '--format=zip',
    '--prefix=plugin.video.reely/',
    '-o',
    OUTPUT,
    `HEAD:${FOLDER}`,
  ],
  { stdio: 'inherit' }
)
if (result.status !== 0) {
  console.error(`git archive exited ${result.status}, no add-on zip was built`)
  process.exit(result.status ?? 1)
}
const { size } = fs.statSync(OUTPUT)
if (size < 1000) {
  console.error(`${OUTPUT} is only ${size} bytes, expected a whole add-on`)
  process.exit(1)
}
console.log(`${OUTPUT}: ${size} bytes`)
