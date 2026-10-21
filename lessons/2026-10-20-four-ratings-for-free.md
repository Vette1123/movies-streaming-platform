# Four ratings, for free

## What

The details page now shows four scores side by side — IMDb, Rotten Tomatoes,
Metacritic and TMDB — in a `Ratings` strip under the hero, and the hero's
action captions were rewritten so they stop breaking mid-phrase.

The ratings are the point of the feature, and the constraint behind it is the
one this whole codebase runs on: **a rating must not cost a TMDB request.** The
detail payload already carries the `imdb_id`, so:

- **IMDb** comes from the free Non-Commercial dataset, prebuilt into 256
  shards (`pnpm imdb:ratings`, 1.9MB) and read off disk at build time. No key,
  no rate limit, no request.
- **Rotten Tomatoes and Metacritic** come from OMDb's free tier (1,000
  requests/day, no card) through `services/omdb.ts`. There is no free official
  RT API — every "free RT API" is somebody's server, and the official one is a
  Fandango licensing conversation.
- **TMDB** was already in the payload.

The strip is server-rendered into the prerendered pages, so it costs **zero
Worker CPU and zero subrequests**: the pages that show it are static assets,
and the Worker's tail-id fallback serves the exported shell, which has no
ratings in it.

The answers are cached on disk (`.cache/media-ratings/<imdb_id>.json`) and the
cache travels between deploys, so after the first day a build makes **no OMDb
request at all** — the quota is only ever spent on a title nobody has looked
up yet.

The hero's action captions were the other half of the ask ("the labels are too
bad, they break"). Six actions share ONE row on a 360px phone (318px against
320), so a caption that wrapped ("Add to" / "list") read as a mistake. The
captions are now one word each on a phone, with the full phrase in the
tooltip from `sm` up, and `whitespace-nowrap` so nothing breaks in half.

## Mistakes

- **The flag was `NEXT_PUBLIC_IMDB_RATINGS`, which would have switched the
  WORKER on too.** Next inlines every `NEXT_PUBLIC_*` into the client bundle
  and `scripts/build-worker.mjs` inlines the same vars into the Worker bundle.
  The Worker's detail path calls `populateMovieDetailsPage`, which calls
  `getImdbRating` — so the flag would have made every tail request read a
  shard: one more subrequest and one more JSON parse on the route that is 63%
  of all invocations. Renamed to `IMDB_RATING_SHARDS`, a server-only var that
  stays a runtime lookup in the Worker, where it is undefined.
- **Almost shipped the same mistake through `copyEnv`.** The Worker copied
  `NEXT_PUBLIC_IMDB_RATINGS` out of its own env into `process.env`. Removed,
  with the reason written next to the list.
- **Wrote the OMDb cache to `public/`.** The export copies `public/` into
  `out/`, and the copy happens at a point in the build this repo does not
  control — a file written during page rendering might not be in the export at
  all. The cache is a build INPUT, not something the site serves, so it lives
  in `.cache/` and the ratings end up in the prerendered HTML, which is where
  they are wanted.
- **The first ingest would have blown the OMDb quota.** 1,037 prerendered
  pages against a 1,000/day cap, four builds a day. The disk cache plus a
  day-keyed CI cache with a `restore-keys` line is what makes it a one-time
  cost; without the cache the second build of the day would have failed every
  title.
- **The cache was not "hard" enough at first.** The first version cached only
  a POSITIVE answer, on the reasoning that a title OMDb does not know should
  be looked up again later. That is right for a title OMDb adds next month and
  wrong for a title that does not exist: it costs a request on every build,
  forever, and 60 of them eat the day's quota. Now a missing answer is cached
  too, with a WEEK's life instead of a month's, and the day's spend is bounded
  by a counter FILE (read and written under a lock file, because two render
  processes must not both decide there is budget left) at 800 — under the cap,
  so a build that is refused mid-way cannot lock the rest of the catalogue out
  of the quota for good. A 401 from OMDb stops the whole build: asking the
  other thousand titles again would spend nothing and gain nothing.
- **Shipped the shards, then took them back.** The IMDb shards were written to
  `public/`, which put 256 files in the static export for a rating nothing
  fetches at runtime — 256 of the 20,000-file asset cap that is the real
  ceiling on this site's size, and 1.9MB of deployment. They are a BUILD
  INPUT, so they live in `.cache/` now (with the OMDb answers), and the
  Worker's shard-read path went with them: the score is baked into the
  prerendered HTML, and the tail-id fallback serves the exported shell, which
  has no ratings in it.
- **`NEXT_PHASE` is not set in `next dev`.** Measured, twice, and wrong both
  times: the first version gated the cache on it, so dev had no cache and no
  budget, and the budget is what decides whether a request happens at all. The
  test that actually holds is "is this the Worker bundle" — `NODE_ENV` is
  inlined as `"production"` there and nowhere else that matters.
- **Made a component async and broke every tail page.** Resolving the ratings
  inside the details content meant making it `async` — and
  `app/media-fallback/page.tsx` is `'use client'` and imports it, which makes
  the details content a CLIENT module, where an async component is React
  error #482. Nothing in the file says "client": a module without
  `'use client'` is a server component until something in the client graph
  imports it, and then it is not. The 1,000 prerendered pages never touch
  the fallback shell and never saw it, which is how it reached a deploy.
  The ratings are resolved by the page (a server component) and handed in as
  a prop instead, and `tests/client-graph-async.test.ts` pins it.
- **The site showed two numbers for the same film.** The card and the hero
  chip showed TMDB's average ("8"), the details hero showed IMDb's ("IMDb
  9.3") and the ratings strip led with IMDb again. A reader had no way to
  know that was two SOURCES rather than one number that changed between
  pages. So there is now ONE canonical score — TMDB's, the one the JSON-LD's
  aggregateRating already used — and it leads everywhere: the card, both
  heroes, and the first tile of the strip, all in one decimal ("8.0", never
  "8"). The other three sources are the details page's labelled extras.
- **The OMDb key has to be ACTIVATED.** The signup email carries a
  verification link; until it is clicked, every request answers 401
  `Invalid API key!` — which reads exactly like a wrong key. The key is also
  eight characters, not the 32 hex characters every example online shows, so
  "that is not a key" was the wrong conclusion to reach.
- **Could not reproduce the skipped-transition error from the logs.** The
  PostHog events said "AbortError: Transition was skipped" and nothing else —
  no stack frames, because it is a browser-generated DOMException. Read
  React's RSC flush inside Next's app-page runtime to find the cause instead
  of guessing: it hangs `.finally()` off the transition's `ready` and
  `finished` promises **without catching them**, and a skipped transition
  rejects both.
- **Searched for a free Rotten Tomatoes source and nearly shipped a scraper.**
  Every candidate is a third-party deployment (Vercel, render.com, an
  App-Spot instance) or a scraper of RT's own site. None of them is a
  dependency this codebase should have, and all of them break silently.
  OMDb's free tier is the only answer that is documented and free.
- **The dev server read the shards from PRODUCTION.** `services/imdb.ts` read
  a shard over HTTP at runtime, and the URL it used is `NEXT_PUBLIC_BASE_URL`
  — production. So a local `pnpm dev` showed no IMDb rating until the shards
  had been DEPLOYED, which is a very confusing way to find out whether a
  feature works. The dev path now reads the local file, and the discriminator
  is `NODE_ENV === 'development' || NEXT_PHASE === 'phase-production-build'`
  — the Worker bundle inlines `NODE_ENV` as `"production"`, so it never
  touches a filesystem.
- **First screenshot of the strip was taken with a hard-coded fake in the
  resolver.** It proved the layout and nothing else; the real data came after
  the shards were built locally (`pnpm imdb:ratings`, 108,621 titles).

## What worked

- **The constraint did the design.** "A rating must not cost a TMDB request"
  answered every question: the IMDb dataset for the keyless score, OMDb for
  the two that need a source, the payload for TMDB, and a build-time cache so
  the quota is spent once.
- **A probe that forces the failure.** `scripts/view-transition-probe.mjs`
  starts a transition and calls `skipTransition()` — the browser's own way of
  abandoning one. It fails without the guard and passes with it, which is the
  only way to know a check can fail.
- **`pnpm cf:health` against production, not against a guess.** The crawler
  check was failing on fourteen requests a day; reading the actual User-Agent
  strings showed a mobile Chrome with "(compatible; Googlebot/2.1)" bolted on,
  asking for `/.env`. The check was grading a scraper as if it were Googlebot.

## Rules

- **A public env var is a public decision.** `NEXT_PUBLIC_*` is inlined into
  the Worker bundle, so a flag that only makes sense on the build side must
  not wear that prefix.
- **A free tier with a daily cap needs a cache before it needs a feature.**
  The cap is the design constraint; the cache is what makes it sustainable.
- **If the whole feature is a build-time input, keep it out of `public/`.**
  `public/` is what the site serves, and the export's copy step is not
  something to bet a build on. Every file in `public/` is also a file against
  the asset cap.
- **A check that is permanently red is a check nobody reads.** Fix the
  classifier, not the threshold — and prove the new one still fires on the
  thing it exists for.
- **A label that has to fit in 48px is one word.** The full phrase belongs in
  the tooltip, where there is room for it.
- **"Server component" is a property of the graph, not of the file.** A module
  without `'use client'` is a client component the moment something in the
  client graph imports it, and then `async` is a runtime error. Resolve on the
  server, pass the result down.
- **One score, one number, one place.** If two pages can show a rating for
  the same film, they had better show the SAME one, or the difference reads
  as a bug. Pick the source the site already publishes everywhere (here:
  TMDB's, the one in the JSON-LD) and let the rest be labelled extras.
- **A number that is formatted two ways is two numbers.** "8" on a card and
  "8.0" on a details page is an inconsistency in a different font. One
  formatter, everywhere.
