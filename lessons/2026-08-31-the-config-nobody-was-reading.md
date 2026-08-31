# The config nobody was reading

## What

Two config files had been quietly ignored for months, and one of them was
sorting Tailwind classes against the wrong version of Tailwind.

**Prettier.** Five of the eleven options in `prettier.config.js` do not exist.
`@ianvs/prettier-plugin-sort-imports` dropped `importOrderSeparation`,
`importOrderSortSpecifiers`, `importOrderBuiltinModulesToTop`,
`importOrderMergeDuplicateImports` and `importOrderCombineTypeAndValueImports`
in v4 — separation is expressed by the empty strings in `importOrder`, and the
rest are unconditional now. Prettier printed `Ignored unknown option` five times
on every run. Removed.

**ESLint + Tailwind.** `eslint-plugin-tailwindcss@3` cannot read a Tailwind 4
config, because Tailwind 4 keeps its theme in CSS and v3 looks for a JS file. It
printed `Cannot resolve default tailwindcss config path` once per file and
sorted every class against **stock** Tailwind rather than ours. Upgraded to
v4.4.0 and pointed it at `styles/globals.css` via `cssConfigPath`. That surfaced
2,864 warnings that the broken resolution had been hiding; `--fix` took them to
zero across 138 files.

## Mistakes

- **Ran `eslint --fix` across 138 files and nearly pushed it on the strength of
  "lint is clean now".** It was not clean. Five of the classes the autofix wrote
  do not exist in Tailwind: `scale-[1.03]` became `scale-1.03`, and Tailwind's
  `scale-<number>` is a **percentage**, so 1.03 is not a smaller scale, it is
  not a utility at all. The rule compiled to nothing and the hover zoom on every
  poster, the taste-picker press state and the list-heading underline silently
  stopped. Nothing in lint, TypeScript, or the tests would ever have said so —
  a class that does not exist is not an error anywhere, it is just absent.
  Reverted the four call sites and turned
  `tailwindcss/no-unnecessary-arbitrary-value` off.
- **Trusted an autofix because the tool that wrote it also verified it.**
  `eslint --fix` then `eslint` is a tautology: the same rule that produced the
  rewrite is the one asked whether the rewrite is fine. The check has to come
  from outside the tool — here, compiling each class with Tailwind itself.
- **Wrote three broken verification scripts before one that worked.**
  `compiler.build()` in Tailwind's API is CUMULATIVE: the first call emits the
  whole base layer and later calls emit only what is new, so comparing output
  LENGTH across calls on one compiler says nothing. Two runs reported "0 dead
  tokens" from a compiler that had already emitted everything. A fresh compiler
  per class is what makes the measurement real. A verification script that
  cannot fail is worse than no script, because it is believed.
- **Chased a false positive.** The compile check flagged
  `**:[[cmdk-group-heading]]:text-muted-foreground` as dead — but the bare
  `@import "tailwindcss"` used for the check has no `--color-muted-foreground`,
  so the plain `text-muted-foreground` was equally "dead". The variant was fine.
  A verification harness needs the project's theme, or you spend time on the
  harness's gaps rather than the code's.
- **Did not think about `twMerge` until late.** Class ORDER is not cosmetic:
  `cn()` ends in tailwind-merge, which keeps the LAST of two conflicting
  utilities, so re-sorting a string can change which one wins. Checked
  afterwards — 454 pure reorders, none resolve differently — but that was luck,
  not design, and it should have been the first question asked about a sweep
  that reorders every class in the codebase.

## What worked

- **Compiling every class the sweep introduced.** 48 tokens, one fresh Tailwind
  compiler each, "does this produce any CSS at all". That is the check that
  caught the scale bug, and it is cheap enough to run on any future sweep.
- **Splitting the diff into pure reorders and rewrites.** 552 hunks, 112 of them
  not pure reorders. Only those 112 needed reading, and the other 440 could be
  dismissed as a class of change rather than one at a time.
- **Confirming in the browser afterwards** that every rewritten class has a rule
  in the stylesheet the page actually loaded. Belt and braces, but the sweep
  touched 138 files and the compile check ran against a synthetic theme.
- **Upgrading rather than silencing.** The tempting fix was to delete the
  `cssFiles` setting and live with the noise. The plugin's v4 reads Tailwind 4
  properly, so the config-path error was a real signal about a real
  misconfiguration, not noise to be muted.

## Rules

- **A tool's own re-run is not verification of its own autofix.** Check with
  something downstream — compile it, render it, diff the output.
- **A Tailwind class that does not exist fails silently everywhere.** No lint
  error, no type error, no test. After any bulk class rewrite, compile every
  introduced class and assert it produces CSS.
- **Tailwind's `compile()` is stateful across `build()` calls.** One compiler per
  measurement, or the measurement is meaningless.
- **Reordering classes can change behaviour through tailwind-merge.** Ask that
  question before running the sweep, not after.
- **`scale-<number>` is a percentage in Tailwind 4.** Fractional scales must
  stay arbitrary: `scale-[1.03]`, never `scale-1.03`.
- **An "Ignored unknown option" line is a config that stopped being read.** It
  is not decoration; something you believed was configured is not.
