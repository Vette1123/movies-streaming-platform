# Player failures that were not the server

## What
PostHog sweep, 2026-11-10. No open exceptions. `posthog:usage` said the house player "failed 13 times against 11 plays (118%)". Ten of the thirteen were `player_incident dead_on_boot / no_stream`: titles released 3-5 days earlier (Ramayana, Godzilla Minus Zero) that no provider carries yet, seven of them one person retrying the same film. The relay canary was green on every title. `player_failed` now carries `no_stream`, and `whatToDo` subtracts it before judging a server. Also: the free-trial "Reely Player · FREE TODAY" badge was a button-shaped `<span>` collecting dead clicks; it and "Every title" are now one link to /support.

## Mistakes
- First read of the vidsrc.sh stalls: "47 of 48 stalled sessions still played, so the stall is a slow load". Wrong - `media_played` fires on the Watch click, BEFORE the stall, so it cannot prove recovery. There is no event for a late iframe load.
- Entering a worktree (EnterWorktree) pins the shell of every subagent too, so two agents working in another repo's worktrees were locked out mid-task. Spawn cross-repo agents only when this session will not enter a worktree, or finish the local worktree first.

## What worked
- Joining `player_failed` to `player_incident` by person and path: the incident step named the cause the failure event did not.
- Checking the titles on TMDB before touching the relay.

## Rules
- A failure rate is only a server's when the cause is the server's: subtract content availability (`no_stream`) before alerting.
- An element styled like a control must be one.
