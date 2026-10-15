# Continue watching sent you to S01E01

## What

"Pick up where you left off" opened a show at S01E01 when you were in season 3.
The queue (`lib/nextup/progress.ts`) answered with the **first episode nobody
had ticked off**, and a play only counted as a tick when it was the show's
first. Start a show mid-way, or finish episodes on a player that never reported
it, and the first gap was S01E01. The show's own page computed something
different again ("Resume S1 · E1" where the queue said E2). Both now walk one
function, `resumeEpisode`: the episode last played, picked back up while
unfinished, else the first unfinished episode after it. Never backwards.

Five more holes in the same loop, all fixed:

- **Nothing ever counted as watched.** A Reely Player `ended` only cleared the
  position, and most people close the tab during the credits anyway. Now both
  the house player and any embed that reports progress tick the episode (or
  film) off at `ended` or past 95% (`isFinishedAt`, the same threshold resume
  already used).
- **Autoplay never moved the bookmark.** `handleEnded` started the next episode
  without writing history, so a night of autoplay left "continue" where it began.
- **The tab's own URL beat the resume.** Pressing play mirrors
  `?season=2&episode=3` into the address bar; reload after finishing it and the
  deep link offered the credits again. A deep link to a finished episode now
  yields to the resume target (`pickPlayTarget`).
- **The settings gear restarted the episode on the old subtitles.** It remounts
  the player, and within 45s the remount reused the warm ticket, whose URL
  carried the old `sub` and the old `start`. Tickets are now spent by the mount
  that boots from them (`takeTicket`), and any prefs write drops warm ones.
- **Subtitle and quality picked IN the player were forgotten.** The player never
  told the page. It now posts `{ kind: 'prefs', sub | quality }` on a menu pick;
  the page saves it like any setting, the ticket carries `q`, and the player
  pins the closest rendition at or under it on boot. Device mirror and account
  disagreed too: the mirror won, so a phone that once picked Arabic kept Arabic.
  The account wins now (savePrefs is optimistic, so it also holds this tab's own
  writes).

Lag: series pages never warmed the player ticket before the tap (`selfHost`
was undefined until play), so they always paid that round trip after it. The
bigger cause is upstream: see the player repo's lesson of the same date. The
provider is answering our relay with 429.

`pnpm resume:probe` (needs `pnpm dev` + `pnpm harness` in reely-pro-player)
drives the real page and the real player bundle through all of it.

## Mistakes

- First reading of the bug was client-side: the hero's resume logic looked
  correct, so I nearly went looking for a hydration race. The homepage row is
  computed **server-side** by a different function with a different rule.
  Should have diffed the two surfaces first, since one of them worked.
- An existing test pinned the wrong behaviour ("show started at S01E01 answers
  E2", "returns the first GAP"). A test that encodes a design decision is not
  evidence the decision was right; the user's report was.
- The probe's first full run failed the last step: after finishing S2E3 the
  hero still offered S2E3. Looked like the tick had not landed. It had. The
  reload kept the `?season=2&episode=3` the play button itself wrote. A fourth
  bug, found only because the probe reloaded instead of navigating fresh.
- Assumed the saved-720p boot landing on 480p was a bug in `levelForRung`. The
  test stream has no 720 rung (1080/480/240/144); 480 is the right answer.
  Checked the manifest before touching the code.
- My chain probe of the production relay sent ~20 provider calls into a limiter
  that was already refusing. Stopped once the 429s showed.

## What worked

- Reproducing the queue bug as a red unit test against the OLD function
  (`series:1399:2:1` → `{ season: 1, episode: 1 }`) before rewriting it.
- Seeing every new test fail with the fix reverted (single-use ticket, account
  precedence) before trusting it.
- Extracting the search probe's DevTools plumbing into
  `scripts/lib/headless-chrome.mjs` on the second caller, and re-running
  `search:probe` to prove the refactor.
- Answering the Worker inside the probe (refresh, ticket, account save) and
  pointing the ticket at the player harness: the real page and the real player
  bundle in one run, no deploy, no secrets.

## Rules

- Two surfaces answering the same question must call the same function. The
  homepage queue and the show page now share `resumeEpisode`.
- The bookmark is the last play; completion only says whether to move past it.
  Never walk back to a gap.
- A cached URL that embeds user state (start position, prefs) is single-use.
- A preference set inside a cross-origin player must be reported out, or it
  does not exist.
- Probes reload. A fresh navigation hides every bug that lives in the URL.
