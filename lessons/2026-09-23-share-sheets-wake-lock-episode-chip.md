# Share sheets, a wake lock and a named episode

## What

A second enhancement pass over the Watch Together, taste-match and airing
surfaces:

- **Invite goes to the share sheet.** The room bar's "Copy link" is now
  "Invite". On a phone it opens the native sheet, since an invite is headed for
  a chat app; on desktop it copies and toasts. It runs through `useShare`, the
  path every other share button already takes, and it still strips `host` and
  the remote key.
- **`/compare` has "Share result".** It shares the canonical handles (a typed
  `GADO` / `@sara` becomes `a=gado&b=sara`) with the score in the message line.
- **The phone remote holds a screen wake lock** while the pad is live, and
  takes it back when the tab returns, since the system drops it on hide. If the
  lock is unsupported or refused, the phone sleeps as it always did.
- **The airing chip names the episode**: "S38 E1 airs in 4 days". Season 0
  (TMDB's Specials) and missing numbers fall back to the plain label.
  `episodeCode` / `withEpisode` in lib/airing.ts, with tests.
- **/watch-together** leads with the picker. The three steps sit under it with
  icons (the third one mentions the phone remote), and the "(beta)" in the h1
  became a chip.
- `useShare` gained optional `text` and `copied`, and its toast lost its em dash.

## Mistakes

- Reached for a new `invitePath` helper before seeing it was
  `new URL(inviteHref(href))` plus pathname and search: one line at one call
  site. It stayed inline.
- Tried to reach TMDB from a node script inside the sandbox; the connection
  timed out. Network scripts need the sandbox off (already in memory, and still
  missed on the first try).
- A navigation was refused while the permission classifier was briefly down,
  and the follow-up script ran against the previous page and burned its 45s
  timeout. When a navigation fails, check the tab's URL before running the next
  step.

## What worked

- Stubbing `navigator.share`, `navigator.clipboard` and `navigator.wakeLock` in
  the page proved both the sheet and fallback paths, plus the lock's
  single-acquire guard (two visibility events, one request), without opening
  a real system dialog in the automation tab.
- Picking the airing test title from TMDB's `on_the_air` list instead of
  guessing an id.

## Rules

- An invite or a result link goes through `useShare`, never a raw clipboard
  write: phones get the sheet for free.
- A wake lock is re-acquired on `visibilitychange`; the platform releases it on
  every hide.
