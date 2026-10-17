# Everything to latest

## What

Every dependency moved to its latest version. Next 16.3.0 → 16.4.2 and React
19.2.8 → 19.3.1 (and `@types/react*` 19.3.0 in package.json AND the workspace
overrides) moved together. Then the majors: TypeScript 6.0.3 → 7.0.2, ESLint
9 → 10, Vitest 4 → 5, framer-motion 12 → 14, plus the Radix, TanStack, nuqs,
PostHog, lucide, wrangler, prettier, postcss and sharp (override + devDep)
sweep.

What made the majors land:

- **TypeScript 7 has no JS compiler API.** The package's main export is
  `lib/version.cjs`. Two consumers needed the old API:
  - typescript-eslint (inside `eslint-config-next`) parses every .ts/.tsx
    through it and throws "typescript-eslint does not support TS 7.0".
    `.pnpmfile.cjs` turns its `typescript` peer into a dependency pinned to
    6.0.3, for the linter's packages only.
  - Next refuses to start on a TypeScript without the API unless
    `experimental.useTypeScriptCli` is on. With it, the build type-checks by
    running `tsc` 7.

  TS 7 also flagged one real thing TS 6 let through: `let calls: number` read
  in a closure before any assignment (`tests/ticket-cache.test.ts`).

- **ESLint 10** is outside `eslint-plugin-react`'s declared range (^9.7). It
  was kept only after a canary file proved every plugin still fires: react,
  react-hooks, next and tailwind.
- **framer-motion 13/14** breaking changes are the dropped optional
  `@emotion/is-prop-valid` (never installed here) and removed internal APIs
  (not imported).

Used from the upgrades:

- React 19.3's stable `<ViewTransition>` with Next 16.4's `transitionTypes` on
  `<Link>`. Detail links crossfade into the page, and nothing else animates.
- React 19 `preload()` and Next's `useLinkStatus`, for the details-page flash
  (see the lesson of the same date).
- `pnpm typecheck`: TS 7's native `tsc`.

## Mistakes

- Told the user TypeScript 7 "isn't ready" and kept 6.0.3, because the
  linter's peer range excluded it. The blocker was one package's peer, not the
  compiler. The answer was to give the linter its own TypeScript and move
  everything else.
- First tried `packageExtensions` to add `typescript@6` as a dependency of the
  typescript-eslint packages. When a name is both a peer and a dependency,
  pnpm resolves the peer, so the variant actually loaded still linked 7.0.2.
  Measured by resolving `typescript` from each package directory, then lint
  failed anyway. `readPackage` in `.pnpmfile.cjs` can delete the peer, which
  is what works.
- Read `lint exit 0` off a pipeline whose last command was `tail`. The lint
  had thrown. Capture the exit code of the command you mean.
- The research summary called `@eslint/eslintrc`'s FlatCompat layer an
  ESLint 10 risk. The config doesn't use it. Check the config before trusting
  a summary of it.
- Put the first `<ViewTransition>` around the details hero. It never fired:
  React only runs `enter` for a boundary that comes before every DOM node the
  transition inserts, and the hero sits inside the page's own `<header>`. It
  now wraps the page. Around `<main>` would have slid between scroll offsets.
- Called the crossfade done because `startViewTransition` fired once with the
  right type. It fired, but it was not a crossfade. Filmed at 0.1x
  (`Animation.setPlaybackRate`), it showed two things:
  - The page left on a cut. When nothing outside a boundary updates, React
    hides the root's snapshot, so the details page faded in over bare
    background: a 200ms blank, the flash this whole day was about. An inline
    `view-transition-name` on `<html>` is what React's cancel check skips.
  - The fixed nav vanished for the fade, because the page's own snapshot
    paints above everything in the root. It gets its own group, on top, for
    `to-details` only.
- `pnpm update` died in `@posthog/cli`'s postinstall: `Expand-Archive` can't
  load in the PowerShell that Git Bash spawns, and pnpm writes nothing when
  that fails. The same command from PowerShell 7 worked.

## What worked

- Canary files to prove the linter still works on a major. Plant one known
  violation per plugin and expect each to fire. A clean run on clean code
  proves nothing.
- Counting `document.startViewTransition` calls and their `types` from an
  init script, to prove which navigations animate.
- Slowing every animation to 0.1x over CDP, then filming with the screencast.
  `Page.captureScreenshot` blocks until a view transition ends, so it can
  never show one.

## Rules

- "Not supported" usually means one package's peer range. Find which package,
  then isolate it (pnpmfile) rather than holding the whole tree back.
- Majors need a canary, not a green run.
- `packageExtensions` can't beat a peer; `readPackage` can.
- A view transition firing is not the transition looking right. Watch it
  slowed down, frame by frame, before calling it done.
