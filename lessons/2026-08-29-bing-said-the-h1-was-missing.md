# Bing said the `<h1>` was missing, and it was right

**Date:** 2026-08-29
**Trigger:** Bing Webmaster Tools SEO report for reely.space (5 findings, exported as CSV).

## What

Bing's SEO scan reported five things. Four are ours, one is not:

| Finding | Count | Where it actually was |
| --- | --- | --- |
| Meta descriptions too short | 53 pages | Detail pages whose TMDB `overview` is one line or empty |
| `<h1>` missing | 3 pages | Tail detail pages — the fallback `<h1>` shipped inside `<div hidden>` |
| Important pages missing in sitemaps | 3 pages | The similar/recommended rails link outside the prerendered set |
| Not submitted via IndexNow | 1 page | Same root cause — IndexNow submits the sitemap |
| No inbound links from high-quality domains | 1 | Off-site. Not a code change. |

Fixed:

- **`lib/seo-description.ts`** — one builder for the meta description of a title
  or a franchise, used by both `lib/media-page.ts` (prerendered) and
  `cloudflare/worker.js` (tail ids). Trims on a word boundary at 158 characters
  and, when the synopsis cannot fill the slot, spends the rest of the budget on
  the title/year/genre line plus the longest closing sentence that still fits
  whole.
- **`cloudflare/worker.js`** — the crawler block is clipped (`clip-path`), not
  `hidden`, and `aria-hidden` so a screen reader does not hear the page twice.
- **`app/sitemap.ts` + `buildLinkedMediaIds`** — the sitemap now advertises the
  ids the prerendered pages link to. 2,386 → 14,921 URLs, at no extra TMDB cost:
  it is handed the same service function the detail page renders from, so Next's
  build fetch cache serves the second read.
- **`app/reels/page.tsx`** — the trailer feed had no `<h1>` at all. Bing had not
  reached it; the audit script did.
- Genre, terms, disclaimer and the `/lists` directory descriptions, which were
  69-99 characters. Bing tolerated them. They were still thin.
- **`scripts/verify-seo.mjs`** — a description floor on every indexable page, an
  assertion that the fallback block is not `display:none`, and a check that every
  title a detail page links to is in the sitemap.

## Mistakes

- **Estimated the sitemap growth from a sample and was out by 7x.** Sampled 224
  of 893 movies and 228 of 911 series, measured 0.7 and 1.7 new ids per title,
  and extrapolated ~2,100 new URLs. The real build produced 12,535. A per-item
  average taken from a sample undercounts the size of a *union* — each extra
  title contributes ids the sample never saw. It happened to land inside the
  50,000-URL sitemap limit; it was not checked against that limit first, and if
  the real number had been 60,000 it would have been found by a broken deploy.
- **Shipped a build that ran into Next's 60-second page timeout and called it
  green.** The first `pnpm build:cf` failed outright; the second passed — with
  `Failed to build /sitemap.xml/route (attempt 1 of 3) because it took more than
  60 seconds` buried in the log. A build that only passes on a retry is a build
  that fails on a slower network, and the deploy workflow runs on every push.
  Fixed with `staticPageGenerationTimeout: 300`. Read the whole log, not the
  exit code.
- **Assumed "missing h1" meant the pages had no heading.** They had one, twice
  over: the React app paints one, and the Worker injects another. The injected
  one was inside `<div hidden>`, which is `display: none`, which a crawler reads
  as absent — so the only three pages reported were the three whose client render
  Bing never waited for. The report was about the fallback, not the page.
- **Three of the URLs Bing named are still not in the sitemap.** `/tv-shows/9079`,
  `/movies/1008280`, `/movies/273646` are reachable only rail-to-rail from
  *another* tail page, one ring further out than the harvest goes. Harvesting a
  second ring means ~13,000 more build-time TMDB reads. The class of gap is
  closed; those three specific URLs are not, and saying so is better than
  claiming the report is clear.

## What worked

- Asking for the per-finding URL lists instead of working from the summary CSV.
  The CSV says "3 pages"; the detail view says *which* 3, and every conclusion
  above came from reading those URLs against the live HTML. The summary alone
  would have sent the meta-description fix to the wrong pages.
- Diffing prerendered `/movies/550` against a tail id with `curl`. Same shape,
  different producer — which is what made the `<div hidden>` visible.
- Measuring against the live TMDB API before touching `LIST_DEPTH`-adjacent
  code, so the sitemap change was a known quantity rather than a guess.

## Rules

- **A crawler-only block cannot be `hidden`.** `display: none` is "not on the
  page". Clip it (`position:absolute;clip-path:inset(50%)`) and add
  `aria-hidden` if the real render duplicates it.
- **Extrapolating a union from a sample undercounts.** For "how many distinct
  things will N items produce", sample-and-multiply is the wrong shape of
  arithmetic. Check the answer against the hard limit before shipping.
- **`exit 0` is not "the build passed".** Grep the log for `Failed`, `attempt`
  and `Retrying` — Next retries a timed-out route three times and still exits 0.
- **A page the site links to belongs in the sitemap.** The sitemap was derived
  from what the build *bakes*; the rails link past that set on every detail page.
- Bing's SEO summary CSV has no URLs in it. Open each finding and export the
  page list, or you are guessing.

## Files

`lib/seo-description.ts` (new), `lib/media-page.ts`, `app/sitemap.ts`,
`app/collection/[id]/page.tsx`, `app/reels/page.tsx`, `app/terms/page.tsx`,
`app/disclaimer/page.tsx`, `components/media/genre-page.tsx`,
`services/media-summary.ts`, `cloudflare/worker.js`, `next.config.mjs`,
`scripts/verify-seo.mjs`, `tests/seo-surfaces.test.ts`.
