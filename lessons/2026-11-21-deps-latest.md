# Dependencies to latest, 2026-11-21

## What

- Site: @tanstack/react-query 5.108.2, lucide-react 1.77.0, posthog-js 1.453.2,
  tailwind-merge 3.7.1, @typescript-eslint/parser 8.73.0, vitest 5.1.1, wrangler 4.166.0.
  Next 16.4.6, React 19.3.1 and TypeScript 7.0.2 were already latest.
- `video/`: Remotion 4.0.545, React 19.3.1, @types/react 19.3, TypeScript 5.9 -> 7.0.2.
  TS 7 removed `baseUrl`; the `paths` were already relative, so it went.
- The `zod: ^4.6.6` override is gone: Remotion 4.0.545 pins zod 4.6.7 itself (past the
  advisory), and a range override can drift off Remotion's exact pin into a version mismatch.

## Mistakes

- The first local `build:cf` died on `/tv-shows/655` with TMDB 429. It was this IP being
  throttled after a day of builds, not the bump: the retry 20 minutes later built with zero
  429s. The PR CI has no `next build`, so the local build is the only pre-merge build check.

## What worked

- `remotion compositions` prints Remotion's own version-mismatch check and confirms both
  compositions are still 60 fps; one `remotion still` frame proved the renderer.

## Rules

- A TMDB 429 in a local build is the IP, not the code: wait and rebuild once before
  touching anything.
- When Remotion bumps its own zod pin, delete our override instead of chasing it.
