# Provisioning the D1 database, and where seeds must not live

## What

Created the production D1 database (`reely`, WEUR), applied `0001_accounts.sql`
to it, put the real `database_id` in `wrangler.jsonc`, uploaded the account
secrets to the Worker and mirrored them as repo secrets, and added seeds:

- `db/seed.dev.sql` — a full local fixture: a pro account, a session row whose id
  is `sha256('dev-session-token')`, four sync items, two lists (one published),
  a notification, a tracked series. Enough to open `/account` against
  `wrangler dev` with every panel populated and no Google client involved.
- `db/seed.owner.sql` — the only seed that belongs in production: `supporters`
  rows for the owner's addresses, `source = 'owner'`, so signing in with Google
  grants `pro` through the same `claimSupporterGrants` path a real purchase uses.
- `pnpm d1:migrate` / `d1:migrate:remote` / `d1:seed` / `d1:seed:owner[:remote]`.

## Mistakes

- **The seeds were written into `migrations/`, and wrangler ran them as
  migrations.** `wrangler d1 migrations apply` treats _every_ `.sql` file in the
  migrations directory as a migration, in filename order. `pnpm d1:migrate`
  cheerfully reported `0001_accounts.sql ✅ seed.dev.sql ✅ seed.owner.sql ✅`,
  and recorded all three in `d1_migrations` — which means the very next
  `d1:migrate:remote` would have inserted a fake user, a fake session and two
  fake lists into the production database, and then never run them again so the
  rows would have looked original. Caught by reading the table wrangler printed
  rather than the exit code. Seeds moved to `db/`, applied with
  `d1 execute --file`, and the stale rows deleted from the local `d1_migrations`.
- **"The token lacks D1 permission" was wrong, and stayed wrong for a while.**
  The `401 code 10000` was real, but it came from the _old_ token; the
  replacement (see [one Cloudflare token, one env file](2026-08-16-one-cf-token-one-env-file.md))
  had D1 all along. The failing call was never retried after the token changed,
  so a solved problem was reported as a blocker. Re-run the failing command
  after changing the credential it failed on.
- **`sha256('dev-session-token')` was pasted from memory** and was actually
  `sha256('foo')` — the well-known `2c26b46b…` digest. It would have produced a
  seed whose session silently never matched. Computed it instead.
- **A generated secret was uploaded and then thrown away.** The first
  `SESSION_TOKEN_SECRET` was piped straight into `wrangler secret put` from a
  subshell, so nothing else could ever hold the same value — and the GitHub
  mirror would then have overwritten Cloudflare's copy on the next rotation
  dispatch, invalidating every live session. Regenerated once into a variable
  and written to both.
- **`wrangler d1 execute` leaves workerd running**, and it holds `out/` open, so
  the next `build:cf` died with `EBUSY: rmdir 'out'`. Killing workerd is not
  enough — the parent wrangler node processes respawn it. Kill the parents first.

## What worked

- Verifying the remote schema by querying it (`sqlite_master` joined to
  `pragma_table_info`) rather than trusting the migration's exit code. Column
  lists came back matching, including the two that arrived late in development
  (`lists.published`, the `users.sub_*` block).
- The dev fixture is a real session row, not a bypass: the Worker authenticates
  it exactly as it authenticates a Google sign-in. `/api/auth/refresh` returned
  `pro: true` with the plan block, `/api/sync` returned all four items, `/api/lists`
  both lists, `/l/rewatch-forever` a 200, and the seeded prefs applied
  `data-accent="violet"` + `data-density="compact"` in the browser.
- Seeding the owner's entitlement through `supporters` rather than by writing
  `grants` onto a user row: there is no user row until the first sign-in, and
  the supporters path is the one a real purchase takes.

## Rules

- Nothing but migrations goes in `migrations/`. Seeds live in `db/` and are run
  with `d1 execute --file`.
- Read what a migration tool says it applied, not whether it exited zero.
- Never pipe a freshly generated secret directly into one consumer. Generate
  once into a variable, then write it everywhere it has to match.
- Compute digests, do not recall them.
- Before `build:cf` on Windows: kill the wrangler parents, then workerd.
