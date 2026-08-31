// Release notes for the deploy that just shipped, from the commits in it.
//
//   node scripts/release-notes.mjs           # print the notes
//   node scripts/release-notes.mjs --tag     # print just the tag it would use
//
// The site has no version number and nothing to install — it is continuously
// deployed, so a release here is a dated public record of what changed, not a
// package. That is why the tag is a date (`v2026.08.31`, `.1` on the second
// release of the same day) rather than semver: there is no API to promise
// compatibility with, and a bumped minor would mean nothing to a reader.
//
// Notes are built from Conventional Commit subjects, which this repo already
// enforces. `feat`/`fix`/`perf`/`revert` are what a reader came for; docs,
// chores, tests, refactors and style are real work that says nothing to anyone
// outside the repo, so they are counted rather than listed. A release with
// nothing but those is not published at all: the `has_visible` output written
// at the bottom is what the publish step's `if:` reads in
// .github/workflows/deploy.yml.

import { execFileSync } from 'node:child_process'

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8' }).trimEnd()

/** Newest `v*` tag by commit date, or null on the first ever run. */
function lastTag() {
  try {
    const tags = git('tag', '--list', 'v*', '--sort=-creatordate')
    return tags.split('\n').filter(Boolean)[0] ?? null
  } catch {
    return null
  }
}

/**
 * `v<YYYY.MM.DD>`, with `.N` appended once that date is taken.
 *
 * UTC, to match the workflow's own `date -u` and the schedule's cron, so a
 * deploy at 01:00 Cairo does not get yesterday's date on one machine and
 * today's on another.
 */
function nextTag() {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
  const base = `v${today}`
  let existing = []
  try {
    existing = git('tag', '--list', `${base}*`).split('\n').filter(Boolean)
  } catch {
    existing = []
  }
  if (!existing.includes(base)) return base
  let n = 1
  while (existing.includes(`${base}.${n}`)) n += 1
  return `${base}.${n}`
}

// Conventional Commit types, in the order they should read. Anything not here
// (docs, chore, test, refactor, style, ci, build) is counted, not listed.
const SECTIONS = [
  ['feat', 'New'],
  ['fix', 'Fixed'],
  ['perf', 'Faster'],
  ['revert', 'Reverted'],
]
const VISIBLE = new Set(SECTIONS.map(([type]) => type))

/** `fix(seo): robots blocked our own icons` → `{ type, scope, summary }`. */
function parseSubject(subject) {
  const match = subject.match(/^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/)
  if (!match) return null
  return {
    type: match[1].toLowerCase(),
    scope: match[2] || '',
    summary: match[3],
  }
}

/**
 * Subjects since the last release.
 *
 * With no previous tag — the first run, and only ever the first run — the range
 * is the entire history, which would publish a "release" listing two years of
 * commits as if they all shipped today. Fall back to a fortnight instead: long
 * enough that the first release is not empty, short enough that it reads as a
 * release rather than a repo dump.
 */
function commitsSince(tag) {
  const range = tag ? [`${tag}..HEAD`] : ['--since=14.days', 'HEAD']
  const log = git('log', ...range, '--no-merges', '--format=%s')
  return log ? log.split('\n').filter(Boolean) : []
}

const previous = lastTag()
const tag = nextTag()

if (process.argv.includes('--tag')) {
  console.log(tag)
  process.exit(0)
}

const parsed = commitsSince(previous)
  .map(parseSubject)
  .filter((commit) => commit !== null)

const listed = parsed.filter((commit) => VISIBLE.has(commit.type))
const internal = parsed.length - listed.length

const lines = []
for (const [type, heading] of SECTIONS) {
  const entries = listed.filter((commit) => commit.type === type)
  if (!entries.length) continue
  lines.push(`### ${heading}`, '')
  for (const entry of entries) {
    // The scope is the area of the site, which is the most useful thing on the
    // line for someone scanning — keep it, drop the machine-readable type.
    lines.push(
      entry.scope
        ? `- **${entry.scope}** — ${entry.summary}`
        : `- ${entry.summary}`
    )
  }
  lines.push('')
}

if (internal) {
  lines.push(
    `_Plus ${internal} internal ${internal === 1 ? 'change' : 'changes'} — docs, tests, tooling and refactors._`,
    ''
  )
}

const repo = process.env.GITHUB_REPOSITORY
if (repo && previous) {
  lines.push(
    `[Full changelog](https://github.com/${repo}/compare/${previous}...${tag})`
  )
}

// The workflow reads these to decide whether to publish and what to call it.
if (process.env.GITHUB_OUTPUT) {
  const fs = await import('node:fs')
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `tag=${tag}\nhas_visible=${listed.length > 0}\n`
  )
}

console.log(lines.join('\n').trimEnd())
