# Build-time TMDB 429, and a square PWA splash icon

**Date:** 2026-08-20

## What

Two unrelated things in one pass:

1. The deploy pipeline logged `Error: TMDB API error: 429` during "Collecting
   page data" on every recent run, and still went green. Cut the build's real
   TMDB concurrency and gave the 429 retry a longer, jittered ladder.
2. The Android PWA launch screen showed the app icon as a hard square. Rounded
   the two `*-maskable.png` files, which is where Chrome gets that image from.

Also audited the SEO surface against production, since the 429 raised the
question of whether crawlers were landing on empty pages. They are not — see
below.

## Mistakes

**The concurrency cap was read as a global when it is per-process.**
`MAX_CONCURRENT = 10` in `lib/fetch-client.ts` reads like "at most 10 TMDB
requests in flight". It is a module-global inside one Node process, and Next
prerenders with a worker pool — the build log says so on its own line,
`Collecting page data using 3 workers`. The real ceiling was 30, and
`buildMediaStaticParams` fires 55 list requests at once from every one of those
workers. The file's own comment even says "we prerender ~1100 detail pages
across 11 workers" and then sets a per-process number as if it were the fleet
budget. Nobody re-read the two together.

**The failure was designed to be invisible, so it stayed invisible.**
`buildMediaStaticParams` uses `Promise.allSettled` and falls back to `[]` on
throw, deliberately, so a TMDB hiccup can never break a build. Correct — but it
means a 429 that outlives `MAX_RETRIES` silently drops a whole list page: ~20
ids gone from the prerender set *and* from the sitemap, since `app/sitemap.ts`
is built from the same helper. The build stayed green, the deploy succeeded, and
the only evidence was one `console.error` in the middle of 400 lines of log.

**Retry backoff had no jitter.** Every throttled request in the pool slept the
same `500 * 2 ** attempt` and woke together, so the retry wave was exactly as
concurrent as the wave that got throttled. Five attempts spent 7.5s to arrive at
the same answer.

**The splash icon was assumed to come from the rounded icon.** It does not.
`android-chrome-512x512.png` was already rounded (corner alpha 0, verified), so
the square-on-splash report looked impossible. Reading pixels settled it: the
glyph in the screenshot is ~0.35 of the tile, which is `MASKABLE_GLYPH_SCALE`
(0.52), not `DEFAULT_GLYPH_SCALE` (0.78). Chrome composes the Android launch
screen from the **maskable** icon and draws it **unmasked**. Guessing from the
manifest would have gone the wrong way; measuring the glyph ratio was what
identified the file.

**"Maskable must be square" was treated as an axiom.** It is a conclusion, and
the geometry does not support it here. Android maps a maskable icon onto the
108dp adaptive canvas and only ever displays the central 72dp — the outer ~16.7%
of each edge is cropped by every launcher shape. A `SOFT_RADIUS` (0.3) corner
cuts inward to a measured 8.8% diagonal inset. That is entirely inside the band
nothing draws, so rounding it costs nothing on a home screen and fixes the
splash. The old comment in `build-app-icons.mjs` asserted the opposite without
the numbers.

## What worked

- Reading the build log's own phase line (`using 3 workers`) instead of trusting
  the count in a code comment.
- `sharp` on the actual PNG corners, and the glyph-to-tile ratio from the user's
  screenshot, to identify which file Chrome was drawing.
- Checking the SEO claim against production rather than against the code: as
  Googlebot, prerendered pages, tail-id fallbacks, collections and genre pages
  all return `<title>`, `<h1>`, description, canonical, OG and `Movie`/`TVSeries`
  JSON-LD. A tail id (`/movies/47090`, not in the prerender set) carries the same
  markup via the Worker's `HTMLRewriter` pass. robots.txt is ours (not
  Cloudflare's managed one), the sitemap advertises 2,116 URLs, apex 301s to www.
- `scripts/verify-icons.mjs` already measured the corner *radius*, not just
  alpha, so the assertion only had to move lists and gain a `maxInset` ceiling.

## Rules

- A concurrency cap in a module is per-process. Before trusting one during a
  build, find out how many processes the build runs — Next prints it.
- `allSettled` + fail-soft `[]` is right for a build, and it needs a loud enough
  retry ladder underneath, because it converts a hard failure into missing
  sitemap URLs that nothing reports.
- Jitter every retry backoff that more than one caller can hit at once.
- Chrome's Android splash screen uses the **maskable** manifest icon, unmasked.
  Round it. The always-cropped outer 16.7% is the budget; `verify-icons.mjs`
  enforces `maxInset: 0.16`.
- Identify which icon file a platform is drawing by measuring the glyph's share
  of the tile, not by reading the manifest.
