# 2026-09-06 — The numbers were there all along

## What

A day that started as "make the player cheaper to run" and ended as a list of
defects, because every step of it was decided by a measurement rather than by
reading the code and guessing.

### The player, and the ceiling it runs into

The house player streams real HLS through a Deno relay. The question was whether
the visitor's own browser could fetch the film instead, and the answer is: only
if it is WebKit.

Measured one header at a time against a live segment, with the send-neither case
included — the thing [probing headers separately](https://reely.space) exists to
force:

| request                            | segment        |
| ---------------------------------- | -------------- |
| neither `Origin` nor `Referer`     | 200, `ACAO: *` |
| `Origin` theirs / `Referer` theirs | 200, `ACAO: *` |
| `Origin` ours                      | **403**        |
| `Referer` ours                     | **403**        |
| `Origin` ours + `Referer` theirs   | **403**        |
| `Origin: null` (after a redirect)  | **403**        |

CORS was never the obstacle — an allowed request comes back `ACAO: *`. The
_request_ is refused, and a cors-mode `fetch` is required by the Fetch spec to
carry an `Origin` with no way to opt out. Only a media element sends none, so
Safari plays direct and Chrome cannot, ever. The one escape left — putting the
bytes on a host with unmetered egress — is closed too: a Worker on Cloudflare's
own edge gets 403 on the master playlist that answers a home connection
instantly.

What DID pay off was capping what we fetch: `capLevelToPlayerSize` so a 390px
phone stops pulling 1080p, and a 30 MB buffer ceiling. Measured before and
after on the same film: 110s of look-ahead became 55s.

### Then the numbers were read, and they changed the subject

- **Deno Deploy: 0.6 GiB of a 100 GiB month.** The relay's entire audience is
  three supporter grants. The wall is a supporter-count problem arriving near
  thirty regulars, not a bandwidth problem.
- **40% of PostHog was a scraper fleet.** 251 sessions from CN in five days:
  252 pageviews, zero searches, zero plays, zero clicks. Every ratio computed
  before that was found was wrong. With it excluded the site looks healthy —
  388 human sessions producing 399 plays.
- **13% of searches returned nothing**, and the catalogue was innocent: TMDB
  matches prefixes and does no fuzzy matching, so `godfathr` finds zero while
  `godfath` finds The Godfather. All seven real failures are recovered by
  trimming the broken word; 29% of the rest were pasted YouTube and Instagram
  links.
- **The most-clicked dead element on the site was the player's own picture
  area** — 26 clicks across six titles, all of them while it was a spinner.
- **INP is a TV-page problem**: 384ms p75 on the busiest one, over a second on
  three others, while everything else sits under the 200ms threshold.
- **`trackPwaInstalled` had never been called.** "297 installable, 0 installed"
  was not a product failure, it was an unwired listener.

## Mistakes

- **Optimised the bill before reading it.** The whole client-side push was
  motivated by relay bandwidth, and the relay serves three people at 0.6% of
  its allowance. `select count(*) from users` was thirty seconds of work and it
  came last. The work is right for the day it matters; the ORDER was wrong.
- **Trusted a 30-day analytics window over a bot-fleet block.** The first
  browser split said WebKit was 1.1% of 95,665 sessions. Almost all of those
  sessions predate 2026-09-01, when the last fleet was shut out. Windowed after
  it: 619 sessions, WebKit 8.6%. Any PostHog query on this project has to start
  after that date or it is measuring scrapers.
- **Read a 403 rate off Cloudflare and started debugging the wrong thing.**
  `httpRequestsAdaptiveGroups` showed a third of `/api/search` calls as 504.
  `pnpm cf:health` — reading the Worker's own logs — reported zero kills and one
  5xx in 24h, and ten hand-made requests all returned 200 in under 300ms. Two
  sources disagreeing is the signal to stop and reconcile, not to pick the
  alarming one.
- **Wrote a fix into a file with CRLF endings using LF anchors**, three times,
  before normalising the read. The replacement silently found nothing and the
  script reported a clean miss only because it was written to exit on it.
- **Built a KV egress meter for the relay and deleted it.** Deno's new console
  offers Postgres, not KV, so it would have reported `unavailable` — and the
  dashboard already gives the number authoritatively, for free, with no code in
  the hot path.

## What worked

- **`wrangler dev --remote` to answer "can Cloudflare reach this?"** It runs the
  worker on a real edge IP with no deploy. A local dev server would have
  answered with this machine's home connection, which passes, and the answer
  would have been wrong.
- **Attribution before implementation, everywhere.** The dead-click fixes came
  from `elements_chain`, not from opinion: the player stage, the hero synopsis
  and the season picker were the top three by count, and each one had a
  specific, obvious cause once named.
- **Verifying the loosening against production before writing the code.**
  `posses`, `conju`, `avat`, `godfath`, `spiderm`, `shawshank` and `Ride` were
  all confirmed to return the intended title FIRST, by curl, before a line of
  `search-loosen.ts` existed. The tests are that list.
- **Driving the UI states with a stubbed `fetch` in the browser.** `/api/*` does
  not exist under `next dev`, so the three new search panels were verified by
  standing in for the Worker in the page and reading the rendered text back.
- **`textContent`, never `innerText`, in the automation browser.** The tab is
  permanently hidden and rendering is throttled, so `innerText` returns empty
  for perfectly rendered markup — twenty minutes went into that before the note
  in memory was recalled.

## Rules

- **Count the users before costing the bytes.** A per-viewer optimisation is
  worth the number of viewers times the saving, and one of those factors is one
  query.
- **Window every PostHog query after the last bot-block date.** The historic
  aggregates on this project are mostly scrapers, and they do not merely add
  volume — they own the ratios.
- **When two sources disagree about production, reconcile before fixing.** Edge
  analytics and Worker logs measure different things; the one that names the
  runtime is the one to believe about the runtime.
- **A failed request is not an empty result.** Search said "No results found"
  and the season list said "No episodes found for this season yet" over our own
  failures — both of which tell somebody the site does not have a thing it has.
- **A spinner is not an answer.** If it can run for more than a few seconds,
  name what it is waiting for, or people will click the thing it is covering.
- **Do the interaction's visible work first and its bookkeeping after.** Every
  localStorage pass, analytics write and derived-state sweep inside a click is
  latency the visitor pays for a result they cannot see.
- **Normalise line endings before anchoring a scripted edit.** This repo's
  working copy is CRLF; every multi-line anchor must be matched against a
  normalised read or it silently matches nothing.
