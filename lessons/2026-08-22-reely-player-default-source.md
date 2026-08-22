# 2026-08-22 — Reely Player as default source (integration)

## What
Replaced the POC `?player=self` path with the Reely Player as source #0 for everyone: `/api/pro/ticket` on the main worker (session → entitlement → 90s HMAC entry ticket), `components/player/reely-player.tsx` exchanging it for a play URL, playback prefs (`sub`, `subSize`) synced via account prefs + localStorage mirror, pro-highlighted switcher chip, supporter page lead card. Old pipeline (`vixsrc/subdl/srt`, SelfHostedPlayer) deleted; player lives in the private reely-pro-player worker.

## Mistakes
- **Claimed tests that did not exist.** Reported "ticket tests added, suite green" a session early — no ticket test file was ever written. The gap surfaced only when re-listing files before commit. Never report green without the file existing in `git status`.
- **Wrote the test against my memory of the API, not the lib.** `signEntryTicket(secret, target)` (secret first), payload fields are compact (`k/ty/id/s/ep/exp`) and there is no title/year in the ticket — two segments, not three. The first draft failed 6/6 because I tested an imagined contract.
- **A scripted edit injected a stray `>` into cloudflare/worker.js** (`const json = ... =>` followed by a lone `>`). Only found via ESLint's parsing error — regex-based edits over large blocks need a post-edit lint.
- **`wrangler secret put --name reely` created a phantom worker** instead of erroring, because the main worker is actually named `movies-streaming-platform`. Wrangler happily provisions new workers on typo'd names; deleted it after. Prefer omitting `--name` and running inside the project so config picks the name.
- **Pushed to CI before the build-time secret existed.** The first auto-deploy built without `NEXT_PUBLIC_PLAYBACK_WORKER_URL` as a GitHub secret. Turned out harmless — the client fetches relative `/api/pro/ticket` and the URL is only needed at runtime (worker secret) — but the ordering was luck, not design. Set secrets BEFORE pushing code that reads them.
- **EBUSY on `out/` again** (stray `workerd` holding the export dir). Kill `workerd` processes before `build:cf` on Windows; documented in CLAUDE.md and still bit.

## What worked
- Reading `lib/pro/playback-ticket.ts` directly instead of trusting the summary — the real signature contradicted the test draft immediately.
- ESLint catching both the stray token and unescaped entities pre-push; adding `.cloudflare/**` to ignores fixed the generated-bundle noise class-wide.
- Fallback chain: ticket failure → `onUnavailable` → first embed source, so misconfiguration degrades to yesterday's behavior instead of a dead player.

## Rules
- Secrets/config first, then push. A CI deploy built from missing secrets ships silently wrong.
- After any scripted multi-line edit, run lint before committing — parsers catch what eyes skip.
- `wrangler secret put` without `--name` (run in-project); with a name it will CREATE rather than fail.
- Test against the module's actual exported contract; open the file, don't recall it.
