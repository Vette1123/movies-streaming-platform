# Slot env vars must be forwarded by the deploy workflow

Date: 2026-08-23

## What

Server 4 (2Embed, custom `/embedtv/{id}?s={s}&e={e}` path shape) was invisible on
production while every recent deploy ran green. Diagnosis: the site WAS current —
the deployed bundle contained all the latest code — but `.github/workflows/deploy.yml`
only forwarded `NEXT_PUBLIC_STREAM_SOURCE_2` and `_3` into the build step. The four
`NEXT_PUBLIC_STREAM_SOURCE_4*` secrets existed on GitHub since 06:53 UTC; they just
never reached `next build`, so Turbopack left each one as a runtime lookup that is
always undefined in the browser and `buildSources()` dropped the slot.

Fix: forward every slot var (`_4`, `_5`, labels, queries, path templates,
`STREAM_DEFAULT_SLOT`) in the workflow, harden `DEFAULT_SLOT` against empty-string
env values in config/sources.ts, and pin both with a test.

## Mistakes

- **"Rebuild to bake the secrets" — an empty commit that could not work.** The
  assumption: adding GitHub secrets + rebuilding is enough. False when the workflow
  never maps them into the job's `env`. Turbopack only inlines env vars that exist
  at build time; it does not fail or warn on the rest.
- **Verified deployment freshness by looking at green checkmarks**, not at the
  artifact. A successful run proves the pipeline worked, not that a given secret
  rode along. The real proof was downloading the live JS chunks and reading which
  `base:` literals were baked (slot 1 and 2 = URLs, slot 3 = `""`, slot 4/5 =
  unsubstituted `process.env` lookups).
- **Nearly shipped a silent default-server flip.** Forwarding
  `NEXT_PUBLIC_STREAM_DEFAULT_SLOT` introduced a new failure mode: GitHub Actions
  resolves an absent secret to `''` (not unset), and `Number('') === 0`, so
  `?? '2'` never fired and the public default would have moved to Server 1.
  Caught because "what does an absent secret become?" is exactly the class of
  question this bug came from. Fixed with `?.trim() || '2'` + test.

## What worked

- Reading the **deployed bundle** instead of guessing: chunk URLs from live HTML,
  grep for `label:"Server N"` context, done in minutes with no build.
- `gh secret list` settled "is the secret even there?" instantly — separating
  "secret missing" from "secret not forwarded" cut the problem in half.
- The degradation design held up: an unmapped slot vanishes quietly instead of
  erroring pages. The failure was invisible by construction — which is also why
  it needed the bundle read to be seen.

## Rules

- **A build-time secret has two halves: the GitHub secret AND the workflow env
  mapping. Adding one without the other is a no-op that looks like progress.**
  When introducing any `process.env.X` read, wire `${{ secrets.X }}` into
  deploy.yml in the same commit.
- To confirm what prod actually runs, fetch the live chunks and read the baked
  literals — green CI is not evidence about env plumbing.
- Optional numeric/boolean env vars parsed with `Number()`/`===` must treat `''`
  as unset, because CI turns absent secrets into empty strings.
