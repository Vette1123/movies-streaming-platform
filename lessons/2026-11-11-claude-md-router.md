# CLAUDE.md back under budget: toolchain detail moved to a path-scoped rule

## What

The project CLAUDE.md was 1,467 tokens against a 1,200 budget and loads on
every turn. The pnpm, CI-label and Windows `out/` explanations and the probe
prerequisites moved to `.claude/rules/toolchain.md`, which loads on
`package.json`, `pnpm-workspace.yaml`, `.github/**` and `wrangler.jsonc`. The
command list stays, one short line each. Now 1,199 tokens.

## Mistakes

- None in the move. One measuring trap: from inside a worktree,
  `context-budget.mjs` also counts the main checkout's CLAUDE.md as a "tier"
  file, because the worktree sits under that folder. That is a side effect of
  where the worktree lives, not a real cost.

## What worked

- Moving whole explanations and keeping a one-line pointer, rather than
  rewording everything a little.

## Rules

- A CLAUDE.md line that explains why belongs in the path-scoped rule for the
  files it is about; CLAUDE.md keeps the what and the pointer.
