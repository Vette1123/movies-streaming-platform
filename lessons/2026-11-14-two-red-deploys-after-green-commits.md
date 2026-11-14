# Two red deploys behind one commit

## What

db84f9e (route budget guard) never reached production. Deploy failed twice in a row:

1. `tests/pro-by-email.test.ts` failed because the commit also picked up the local, untracked `AGENTS.md`. That file is a stale Codex copy of CLAUDE.md, and it still names the old payment provider. Fix: untrack it and gitignore it (PR #200).
2. The new guard in `scripts/cf-deploy.mjs` passed `new URL('../out', import.meta.url)` to `path.join`, which throws `ERR_INVALID_ARG_TYPE`. Fix: the counter moved to `scripts/lib/asset-budget.mjs`, which converts the URL with `fileURLToPath`; `tests/asset-budget.test.ts` pins the URL case (PR #201). Deploy then went green at 16,035 / 20,000 files.

The Reely Player is still down. The relay's provider now serves its egress a Turnstile human check, so the walk gets an empty token. The site keeps skipping the player and plays from the regular servers, as built in [the fallback lesson](2026-11-14-reely-player-down-fallback.md). The relay was not changed to get past the check.

## Mistakes

- A commit that bundled an unrelated untracked file (`git add -A`) went straight to main.
- The guard ran for the first time in CI, after a 3-minute build. Nobody had executed it locally, even once.

## What worked

- `gh run view --log-failed` named both causes on the first read.
- The first fix exposed the second, because the deploy got further each time. Watching the run to the end, not just the merge, caught it.

## Rules

- A script added to the deploy chain gets run once locally, or gets a test, before it is pushed. CI is not its first execution.
- Local-only agent files (`AGENTS.md`) are gitignored, so `git add -A` cannot ship them.
