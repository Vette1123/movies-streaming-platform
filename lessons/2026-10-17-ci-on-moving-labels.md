# CI on moving labels

## What

GitHub announced `ubuntu-latest` moves to Ubuntu 26.04 between 2026-10-19 and
2026-11-19, and Node 24 leaves Active LTS on 2026-10-20 (26 is promoted on
10-28). Instead of pinning either, CI now follows the labels:

- `runs-on: ubuntu-latest`, and Node `lts/*` from one `.nvmrc` (it was `24`,
  written twice, in both jobs).
- A manual run takes `runner`, `node` and `upload_secrets` inputs, so the
  next image or Node line goes through the real build and deploy before the
  label moves. A run that only tries a toolchain leaves the Worker secrets
  alone.
- Lint runs on pushes. Nothing ran it before, and since this morning the
  linter sits on its own TypeScript 6 (`.pnpmfile.cjs`), a split that breaks
  without a sound.
- pnpm 10.28.2 → 12.14.0 (the `latest` tag). `onlyBuiltDependencies` became
  `allowBuilds`, which must name every dependency with an install script or
  the install fails. `.npmrc` held one setting for pre/post hooks the repo
  does not have; deleted. The lockfile gained a leading document that locks
  pnpm itself.

Every action was already on its latest major (checkout v7, setup-node v7,
pnpm/action-setup v6, cache v6).

Verifying the runs turned up a blind alarm. The post-deploy smoke test sent a
hard-coded Chrome 120 user-agent, which since 2026-09-01 is one of the frozen
scraper fingerprints our own WAF blocks. `/movies`, `/tv-shows` and
`/movies/550` answered 403 on every deploy for six weeks, and the step passed,
because only a 5xx failed it. It now reads the current Chrome version from
Google's release feed (a pinned fallback, kept off the WAF list by
`tests/smoke-test-ua.test.ts`) and fails on anything but a 2xx. It was seen
red with the old string.

## Mistakes

- pnpm 12 refused the lockfile: its default `minimumReleaseAge` (1 day)
  rejects any version younger than that, and five came from the morning's
  upgrade. I took the quarantine as the law and resolved eslint, wrangler and
  lucide-react one release back. That was a downgrade nobody asked for, in a
  project whose standing rule is "latest". A new tool default that conflicts
  with a standing rule of the project is a setting to change, not a reason to
  move the project. `minimumReleaseAge: 0`, and the versions went back.
- Took `lts/*` to mean the newest LTS. Without `check-latest`, setup-node uses
  any matching version already on the runner image: the first run got 24.21.0
  three days after 24.22.0 shipped. Read the resolved version in the log;
  "Resolved .nvmrc as lts/*" says nothing about which one.
- Told the research agent the repo had no `.npmrc`. It had one. Check before
  briefing.
- Read prettier's whole-file diff on `deploy.yml` as a formatting problem. It
  was CRLF from the Windows checkout. Check the line endings first; git
  commits LF.

## What worked

- Asking each source directly: `gh api .../releases/latest` for the actions,
  `nodejs.org/dist/index.json` and the Release schedule for Node, npm
  dist-tags for pnpm, the runner-images issue for the image. No version came
  from memory.
- One script comparing every direct dependency with npm's `latest` after the
  re-resolution. `pnpm outdated` printing nothing is not proof by itself.

## Rules

- Track labels (`ubuntu-latest`, `lts/*`), and keep a manual run that can
  name the next one, so the move gets tested before it happens.
- A tool's new default that contradicts the project's policy gets set
  explicitly, with the reason beside it.
- Never downgrade to satisfy a tool. Change the tool's setting, or ask.
- A health check that only rejects 5xx cannot see a block. Assert the status
  you expect, and read what the check actually returned, not just its colour.
