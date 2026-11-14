# Prettier was a convention, not a gate

## What

`pnpm prettier:check` failed on 6 files on main (README, three lessons, the sponsor-expiry script and its test). CI ran typecheck, lint and test, never the formatter, so every hand edit since the last full format slipped through. Formatted the 6 files and added a Format step to `.github/workflows/ci.yml`; `tests/ci-gates.test.ts` fails if any of the four checks leaves the PR workflow.

## Mistakes

- The previous session noticed the 6 failures, called them "already on main" and asked instead of fixing them. A failing check that is not run anywhere is a missing gate, and the fix is the gate, not the files.
- First suspected the sponsor-expiry bot of writing unformatted README text. It only deletes whole blocks; the drift was a hand-widened table row.

## What worked

- Red/green by copying HEAD's `ci.yml` over the file in place, since stashing is blocked in shared trees.

## Rules

- A rule CLAUDE.md states (Prettier style) must have a CI step that fails, or it will drift.
- Formatting stays out of `deploy.yml`: a whitespace diff must never stop a deploy.
