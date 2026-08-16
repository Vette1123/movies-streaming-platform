# Ratings, recommendations and a real import

## What

Four supporter features, all Pro-gated, shipped end to end:

- **Your own score** — `hooks/use-review.ts` + `components/rate-button.tsx`. A
  1–10 rating and an optional note per title, stored in a new `reviews` store so
  it rides the existing sync engine (no table, no endpoint, no conflict rule).
- **Because you watched** — `/api/for-you` + `components/account/for-you-panel.tsx`.
  TMDB `/recommendations` pointed at the last three things actually finished,
  with the whole library filtered back out.
- **Bring a library in** — `lib/import/parse.ts`, `/api/import/resolve`,
  `components/account/import-panel.tsx`. Letterboxd and IMDb CSV exports read on
  the device; only titles needing a TMDB id are sent, never scores or dates.
- **Pick up where you left off** — the `/api/next-up` queue surfaced as a
  homepage rail (`components/main-page/continue-watching.tsx`), with a one-line
  offer instead for a signed-out visitor who has local progress.

The support page's unlock grid went to 13 cards (hero + 12), and the footer,
`/support` supporter branch and account console all name the new features.

## Mistakes

- **Proposed three features that had already shipped.** "Shared list links",
  "export your data" and "stats" were all recommended as next builds; all three
  existed (`/l/<slug>`, `DataPanel`, `lib/stats.ts`). Recommending from memory
  instead of from a grep wasted a whole turn. Already written down after the
  previous batch — and repeated anyway.
- **`/support` supporter branch sat under the sticky header.** `plan-view.tsx`
  used `py-16` where the pitch beside it uses `pt-24 lg:pt-28`. Only supporters
  ever render that branch, so every local screenshot had checked the other one.
  A page with two mutually exclusive branches is two pages to verify.
- **React Compiler rejected a callback whose deps did not match its body.**
  `clear` listed `media?.id` in deps while the body read `media.id`, and the
  build failed with "Compilation Skipped: Existing memoization could not be
  preserved" — not a lint nit, the component silently loses memoization.
- **Verified the account console against `pnpm dev` and got nothing.** Dev has no
  Worker, so `/api/*` is a 404 and the console never gets past "Checking your
  account". Anything behind an account needs `pnpm preview`, not `pnpm dev`.
- **The signed-in browser wiped the seeded D1 rows.** Seeding `sync_items` by
  hand and then opening the app with an empty `localStorage` made the sync engine
  push tombstones over the lot — correct last-write-wins behaviour, and exactly
  wrong as a test fixture. Seed the browser, let it push; do not seed the server.

## What worked

- **A local pro account, minted by hand.** `sessions.id` is `sha256Hex(raw)`, so
  a row plus a `reely_session` cookie plus `reely_account=1` (the hint cookie the
  client checks before it will even ask) is a full supporter session against
  `wrangler dev` — no OAuth. Flipping `users.grants` between `'pro'` and `NULL`
  verified both branches of every new gate in one sitting.
- **Ratings proved by round trip, not by unit test.** Importing a Letterboxd CSV
  and then reading the pill on the detail page checked the CSV parse, the
  5→10-point conversion (4.5 → 9), the TMDB match (Heat 949, Inception 27205,
  Parasite 496243) and the rating render in one pass.
- **The first gap, not the highest plus one** — carried over from the queue work,
  and the reason `S01E01–03` correctly resolves to `S01E04`.

## Rules

- **An account feature is verified under `pnpm preview`, never `pnpm dev`.**
  There is no Worker in dev; every `/api/*` route is a 404 there.
- **Seed the client, not the server.** The sync engine treats the browser as the
  writer; a hand-written `sync_items` row is deleted by the first page load.
- **A component with two exclusive branches needs two screenshots.** Supporter
  and non-supporter, signed in and signed out — the branch nobody renders locally
  is the one that ships broken.
- **Callback deps must match the access shape in the body** (`media`, not
  `media?.id`), or React Compiler drops the memoization and fails the build.
