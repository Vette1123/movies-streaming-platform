# Search Console said Soft 404, and the payload already had the answer

**Date:** 2026-08-31
**Trigger:** Google Search Console for `sc-domain:reely.space` — 30.9k pages indexed, 48.4k not, in six buckets.

## What

The report, bucket by bucket, with what each one turned out to be:

| Bucket | Pages | Last crawled | Verdict |
| --- | --- | --- | --- |
| Server error (5xx) | 15,962 | 2–3 Aug | Stale — the OpenNext CPU kills. Every sampled URL answers 200 now. |
| Duplicate without user-selected canonical | 6,961 | mixed | **Real** — tail pages were near-identical to each other. |
| Crawled — currently not indexed | 10,203 | mixed | **Real** — same cause. |
| Excluded by 'noindex' tag | 9,274 | 4 Jun | Stale — sampled URLs carry `index, follow`. |
| Not found (404) | 1,832 | mixed | **Half real** — person pages we deleted ourselves; the rest are TMDB deletions and correctly 404. |
| Soft 404 | 112 | 15–16 Aug | **Real** — the tail fallback page looked empty. |

Two live causes, both fixed here.

### 1. The tail fallback page had 1,393 characters and none of them were about the title

A detail id outside the prerendered set is assembled by the Worker: an exported
client shell, decorated through `HTMLRewriter` with the real `<title>`, OG and
Twitter tags, JSON-LD and a crawlable `<h1>`. Measured against a baked page:

| | bytes | visible characters |
| --- | --- | --- |
| Prerendered `/movies/550` | 296,667 | 2,405 |
| Tail `/movies/1157186` | 85,288 | 1,393 |

And the 1,393 were the heading, a 158-character meta description, and the nav
and footer that are byte-identical on all ~13,900 tail URLs. That is what
"Duplicate without user-selected canonical" means when the canonical is already
correct and self-referential: the *bodies* are duplicates.

**`lib/seo-facts.ts`** now builds the body from the payload the fallback was
already fetching — a plain TMDB detail, 1.7 KB — which carries `tagline`,
`runtime`, `status`, `vote_average`/`vote_count`, `spoken_languages`,
`production_companies`, `production_countries`, `belongs_to_collection`, and for
a series `number_of_seasons`, `number_of_episodes`, `networks` and `created_by`.
Every one of those fields was in the response and was being thrown away.

The block now carries a generated sentence (*"Van der Valk is an English drama
series that ran from 1972 to 1992, across 5 seasons and 32 episodes, on ITV1."*),
the FULL synopsis rather than the description's 158-character cut, a `<dl>` of
facts, and links to the genre, year and franchise hubs — real crawl paths off a
page that had none. The JSON-LD grew `genre`, `datePublished`, `duration` and an
`aggregateRating`. Measured on the local `workerd`: 1,393 → 2,003 visible
characters, zero extra TMDB requests, and no measurable CPU (the cost is a
handful of string concatenations against a 10 ms budget).

### 2. We were deleting person pages every six hours and telling Google about them

`/person/[id]` is prerendered with `dynamicParams = false` — an id outside the
set is a hard 404 with no Worker fallback, deliberately. The set was TMDB
`person/popular`, read at build time. That list moves daily. So every deploy
retired some person pages, minted others, and the sitemap dutifully advertised
whatever was current. `/person/4866792` and `/person/4095744` were both indexed
and both 404 while TMDB still answers 200 for them.

The set is now a committed file, `data/people.json`, read with no network call
(`getPeopleWithPages`). `pnpm people:refresh` is the only thing that changes it,
it **unions** rather than replaces, and it takes ids on the command line for
exactly the case above — the two 404s are in the file. Two consecutive deploys
now advertise the same person URLs.

## Mistakes

- **We measured what the report named, not what the page was.** Bing's earlier
  scan flagged a missing `<h1>` and short meta descriptions; both were fixed, and
  that was treated as "the tail pages are as good as the baked ones". Nobody ever
  counted the characters. The h1 was there and the description was 158 characters
  — and the page was still 58% site chrome shared with 13,900 others.
- **The data was already paid for.** `services/media-summary.ts` was narrowed to
  a plain detail fetch to get off the 98 KB `append_to_response` payload — the
  right call, measured at 3–6 ms of a 10 ms budget. But the interface was then
  written to the six fields the meta tags needed, and the other twenty in the
  same response were invisible from then on. A type that describes less than the
  response is a type that hides work you have already done.
- **A prerendered set built from a moving list is a page that deletes itself.**
  `dynamicParams = false` plus `person/popular` plus a sitemap entry is a
  three-part promise the build cannot keep. The 404s were not TMDB's; they were
  ours.
- **The first two fixes considered were both expensive and both wrong.** Widening
  the prerendered set (against a 20,000-file cap at ~10 files per route) and
  adding a third Worker fallback shell for people (React-shaped work back on the
  CPU budget). The fix was a 30 KB JSON file in the repo.
- **`pnpm prettier:format` rewrote sixteen untouched files to CRLF.** Reverted
  before committing. Format the files you edited, not the tree.

## What worked

- Reading the raw TMDB response for one movie and one series before designing
  anything — `Object.keys(payload)` is what turned this from "we need another
  fetch" into "there is no fetch".
- `pnpm build:worker` + `wrangler dev` against the existing `out/`, with no
  rebuild: the real `workerd`, the real shells, a tail id in ~20 seconds.
  Counting visible characters on the response is the check that would have caught
  this in the first place.
- Putting the body builder in `lib/`, not in the Worker: `tests/seo-facts.test.ts`
  covers the sentence, the fact list, the hub links, the empty payload and the
  no-votes case without a browser or a deploy.

## Rules

- **A fallback page is not done when it unfurls. It is done when it has a body.**
  Compare it to a prerendered page by visible character count, not by which meta
  tags are present.
- **Never prerender a closed set from a list that moves**, and never put one in
  the sitemap. If the set has to be bounded, commit it.
- **Before adding a request, print the keys of the response you already have.**
- Related: [Bing said the h1 was missing](2026-08-29-bing-said-the-h1-was-missing.md)
  (the same block, the previous round), and `docs/marketing/launch-kit.md` for
  where the Search Console numbers came from.
