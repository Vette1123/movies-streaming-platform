# Player options reach the account

Date: 2026-11-01

## What

The Reely Player's new settings (subtitle colour and background, picture size, brightness, volume boost, night mode) are in Settings > Playback, with a starting quality and a live subtitle preview. `lib/playback-options.ts` is now the one closed-set list: the panel, the browser prefs, the account route and the ticket mint all read it.

## Mistakes

- `normalisePrefs` in `lib/auth/routes.ts` only ever kept `sub` and `subSize`. `miniBar`, `quality` and `audio` were documented as synced and tested in the browser, while the server threw them away, and the localStorage mirror hid it on the same device. `pnpm resume:probe` stubs the account, so it never saw the real route. It would have swallowed every new option too. A test now runs all fields through the route, seen red on the old code.
- Both probes failed at "hydrated play button" and looked like a regression. The dev server had started before `.env.local` was copied into the worktree, so TMDB's base URL was undefined. Read the dev log before suspecting the change.
- The first temporary sign-in stub did nothing because the client only refreshes behind the `reely_account` hint cookie.

## What worked

- A temporary, uncommitted route stub in `app/api` plus the hint cookie gave a real supporter panel on the dev server without touching D1.
- Replacing the three field lists with one validator removed code as well as fixing the bug.

## Rules

- A prefs field is added in `lib/playback-options.ts` and nowhere else on this side, then in the player's `src/player-options.mjs`.
- A probe that stubs the Worker proves the client only. Anything crossing into `lib/auth/routes.ts` needs a test on the route function.
- In a fresh worktree, copy `.env.local` before `pnpm dev`.
