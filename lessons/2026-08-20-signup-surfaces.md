# Four surfaces that argue for an account

**Date:** 2026-08-20
**Area:** `lib/community/*`, `lib/rescue.ts`, `lib/taste.ts`, `app/lists`, `app/start`, `cloudflare/worker.js`

## What

Reely's personal half was invisible from the outside, so nothing on the site made signing in look worth doing. Four surfaces, in order of how early somebody meets them:

- **`/start`** — pick a few titles you like, get twelve real recommendations, keep them. Fully static: the candidates are the popular lists the build already fetches, and the answer is one `/api/filter` discover call off the genres the picks share. No account, no endpoint, no model.
- **`/lists`** — every published list and public profile, indexed. Crawlable because the Worker answers the route and writes the links into the exported HTML.
- **The rescue banner** — on the watchlist and history pages, signed out: "12 saved titles — in this browser only", with a free sign-in next to it.
- **Supporter count and a per-month annual price** on `/support`.

Migration 0007 adds two partial indexes for the directory's reads. Nothing else here writes anything.

## Mistakes

- **Nearly hand-rolled a fourth poster grid.** `/start`'s recommendations went out as a bare `<img>` grid, and the user caught it: the homepage `Card` already does hover details, the watched tick, the score chip, prefetch-on-intent and the blur-up. It was a strictly worse copy of a component sitting one import away, and the second grid on the same page (the picker tiles) genuinely cannot be a `Card` — it toggles rather than navigates — which is exactly the reasoning that made the wrong one feel justified. Reuse the component whose job it is; only hand-roll where the interaction is actually different.
- **Believed the browser over the build for twenty minutes.** A card fix was in `out/lists.html` and in the served HTML, and the page kept rendering the old class. Everything about that looks like a caching bug in the Worker — it was the harness tab holding a stale document. `Network.setCacheDisabled` + `Page.reload(ignoreCache)` settled it in one call. Check what the server actually sent (`curl | grep`) before touching cache code.
- **Three shell-level edits done with `node -e` string replacement silently no-opped.** The `LISTS_PATH` constant never landed, which is a 500 on the new route and nothing anywhere else; `${…}` inside a double-quoted shell string ate two more. Every one of these was found by running the thing, not by reading the diff. If a replacement is not asserted, it did not happen.
- **Wrote a centring assertion from memory again.** Two posters centre at 400, not 290 — same failure as the mosaic work earlier today, a day apart, in the same session.
- **Put the sign-in prompt where the ask was, not where the loss is.** The first cut had the rescue banner on the account page, which is a page you only reach if you were already going to sign in. It belongs above the library it is warning about.

## What worked

- **`run_worker_first` on a real page.** `/lists` is a normal exported route AND answered by the Worker, which decorates it in place — the one path on the site that is both. That is what makes an index of rows written after the build crawlable without giving up the static export.
- **Everything reads rows that already exist.** The directory is three indexed reads, the supporter count is one, the taste picker is a discover call already cached at the edge for everybody else. Four features, zero new tables and zero writes.
- **A floor on the social proof.** `supporterLine` refuses to print a number below twelve: "6 supporters" argues against the site more effectively than silence does. It is tested, because the temptation to print whatever the query returns is exactly how that ships.
- **Saying the true thing first.** The rescue banner is a warning about data loss that happens to end in a sign-in button, not a sign-in prompt dressed as a warning. It earns the click by being useful, and it never appears for somebody already signed in.

## Rules

- Before writing a grid, a card or a tile, find the one the site already has. A different interaction justifies a different component; a different page does not.
- Assert every scripted edit, or make it with a tool that fails loudly. A silent no-op in a Worker route is a 500 nobody sees until deploy.
- When the browser disagrees with the build, `curl` the server before debugging the code.
- Social proof gets a floor. A true number that undersells is still a number that argues the wrong way.
