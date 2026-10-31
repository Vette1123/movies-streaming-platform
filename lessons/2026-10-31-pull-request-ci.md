# Pull request CI for bot PRs

## What

Every repo with Dependabot now checks its PRs, so a bot PR can be merged on a green check. masareef and rafiq run typecheck, lint and the full suite on Dependabot PRs only, to save private Actions minutes. masareef-server shares one verify action between CI and the deploy. Reely runs typecheck, lint and test, without a build. social-media-downloader adds `pnpm verify` to its PR build. Reely's dead Renovate config was replaced with Dependabot.

## Mistakes

- A failed `bash -c` left nothing behind, so nothing needed undoing, but the script was too large to reason about. Generate files from Node and keep shell to git.
- A watcher filtered on a start time that was still in the future, matched nothing, and exited as if everything was done. Wait on run IDs.
- Green `@dependabot rebase` comments changed nothing: a PR that needs no rebase is left alone. Use `recreate`, and check that an update run actually started.
- The first CI runs failed on things a developer machine hides: gitignored generated files, the Egypt timezone, and full git history.

## What worked

Dispatching CI on main before trusting it on a PR. It found all four environment gaps without touching a bot PR.

## Rules

- Dependabot PRs read Dependabot secrets, not Actions secrets. A key a bot PR needs goes in both.
- A CI job's first run is a test of the job. Read it before calling the job done.
