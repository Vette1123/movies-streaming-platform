# The player that was never pressed

## What

"I pick episode 5 or 6 and it takes me to 4 and won't play", on
`/tv-shows/247718?season=2&episode=4`. Two independent bugs, both invisible to
an anonymous fresh-profile probe, which played every episode correctly.

1. **A stall clock with nothing playing.** `PlayerStage` keeps the embed frame
   mounted before play and hides the stage with `display: none`, but it still
   rendered `controls`. `SourceSwitcher` is in there, and it starts a 9s
   "server is not responding" timer on mount. So every page load reported
   `player_failed: stall` 9.0s later and auto-hopped server, and `select()`
   saved the hop as that title's server. For a free account it also became the
   device default and the account's `prefs.source`. In the user's session the
   stalls landed 9.0-9.2s after each page load with no play between them. Their
   MobLand server walked reely → vidsrc.sh → vidsrc.to → vidlink while they
   were reading the page. Over 7 days, 106 of 418 stall reports came from
   sessions that never pressed play at all. Fixed by rendering controls only
   while the stage is active.
2. **The service worker answered E5 with E4's response.** `sw.js` cached RSC
   payloads by full URL and matched them with `ignoreSearch`. The comment said
   "no other query string reaches these paths", but a series page's own
   `?season=&episode=` does. Two things follow:
   - A Cache API response keeps the URL it was stored from.
   - Next's router hard-navigates to `response.url` whenever a payload fails its
     checks (`fetch-server-response.js`: not flight, or the build id differs).

   So when a payload failed, a click on E5 reloaded the tab onto the
   `?season=2&episode=4` that first filled the cache. Because `ignoreSearch`
   returns the FIRST entry and the background refresh wrote under a different
   key, the bad entry was never replaced, and every click reloaded. PostHog
   showed it as `media_played S2E6` followed 0.3-0.8s later by a fresh-document
   `$pageview` (no `$prev_pageview_duration`) at `episode=4`. Fixed by keying by
   path, so the refresh replaces the entry in place, and by serving a rebuilt
   `Response`, so the page sees the request's URL. That second part was
   confirmed in headless Chrome against a stub SW.

## Mistakes

- Read the hero, the episode list, the ticket cache and the playback context
  before looking at what the user's session actually did. Every one of them was
  correct. Ten minutes of PostHog would have shown both bugs at once: the
  9.0s-after-load stalls, and the fresh-document pageviews at the wrong URL.
- The first probe ran as an anonymous visitor in a fresh profile, with no
  service worker controlling the page, no account and no switcher memory. It
  passed and proved nothing about the user's path. A probe that passes on a
  path the user isn't on is not evidence.
- The first version of the regression test passed against the broken worker.
  Node's `Response.clone()` drops a defined `url`, so the mock stored `''`
  where a browser stores the original URL. It went red only after the mock's
  clone kept it.
- Not pinned down: what put a failing payload first in this user's cache. The
  edge, the HTML and `sw.js` all carried one build id when checked, and the
  last deploy was 2.7h earlier. The fix doesn't depend on knowing: the bad
  entry is now replaced on its first refresh and can't redirect anywhere.

## What worked

- PostHog by `distinct_id` around the reported minute. The timing alone (stall
  at load + 9.0s every time) named the first bug.
- Reading the actual Next router source in `node_modules` for when it
  hard-navigates, instead of guessing from symptoms.
- A 30-line stub page plus SW in headless Chrome to settle the one browser
  behaviour the fix rests on: rebuilt responses report the request URL.

## Rules

- Anything that runs a clock on mount (stall detection, hops, autoplay) must
  not be mounted under a hidden surface. `display: none` hides pixels, not
  timers.
- A service worker that serves a cached response for a URL other than the one
  requested must rebuild it. Its `url` leaks into whatever reads it, and Next
  navigates to it.
- Cache keys and match rules must agree. `ignoreSearch` on reads with
  full-URL writes means the first entry wins forever.
- When a user reports a bug, read their session first, then the code.
