# Search Console read the head we throw away on hydration

**Date:** 2026-08-31
**Trigger:** Google Search Console for `sc-domain:reely.space` — 30.9k pages indexed, 48.4k not, in six buckets. The user asked for one thing: "solve that".

## What

The report, bucket by bucket, with what each one turned out to be:

| Bucket                                    | Pages  | Last crawled | Verdict                                                                                                                       |
| ----------------------------------------- | ------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Server error (5xx)                        | 15,962 | 2–3 Aug      | Stale — the OpenNext CPU kills. Every sampled URL answers 200 now.                                                            |
| Duplicate without user-selected canonical | 6,961  | mixed        | **Real** — after hydration every tail page declared the homepage as its canonical, and the bodies were near-identical anyway. |
| Crawled — currently not indexed           | 10,203 | mixed        | **Real** — same two causes.                                                                                                   |
| Excluded by 'noindex' tag                 | 9,274  | 22 Aug       | **Real, and the big one** — the served HTML says `index, follow`; the page says `noindex` a second later. See 3.              |
| Not found (404)                           | 1,832  | mixed        | **Half real** — person pages we deleted ourselves; the rest are TMDB deletions and correctly 404.                             |
| Soft 404                                  | 112    | 15–16 Aug    | **Real** — the tail fallback page looked empty.                                                                               |

Three live causes, all fixed here. The third one — hydration putting `noindex`
back on every page the Worker had just cleared — is the one that explains the
large buckets, and it was found last, after the other two were already fixed and
shipped.

### 1. The tail fallback page had 1,393 characters and none of them were about the title

A detail id outside the prerendered set is assembled by the Worker: an exported
client shell, decorated through `HTMLRewriter` with the real `<title>`, OG and
Twitter tags, JSON-LD and a crawlable `<h1>`. Measured against a baked page:

|                           | bytes   | visible characters |
| ------------------------- | ------- | ------------------ |
| Prerendered `/movies/550` | 296,667 | 2,405              |
| Tail `/movies/1157186`    | 85,288  | 1,393              |

And the 1,393 were the heading, a 158-character meta description, and the nav
and footer that are byte-identical on all ~13,900 tail URLs. That is what
"Duplicate without user-selected canonical" means when the canonical is already
correct and self-referential: the _bodies_ are duplicates.

**`lib/seo-facts.ts`** now builds the body from the payload the fallback was
already fetching — a plain TMDB detail, 1.7 KB — which carries `tagline`,
`runtime`, `status`, `vote_average`/`vote_count`, `spoken_languages`,
`production_companies`, `production_countries`, `belongs_to_collection`, and for
a series `number_of_seasons`, `number_of_episodes`, `networks` and `created_by`.
Every one of those fields was in the response and was being thrown away.

The block now carries a generated sentence (_"Van der Valk is an English drama
series that ran from 1972 to 1992, across 5 seasons and 32 episodes, on ITV1."_),
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

### 3. Hydration put the shell's `noindex` back, and Googlebot renders JavaScript

The Worker strips the shell's `noindex, nofollow` out of what it streams and
writes the real title, description, canonical, OG tags and `index, follow`.
`scripts/build-worker.mjs` even asserts the strip worked. All of that is true of
the bytes on the wire — and none of it survives hydration: React re-renders the
head from the SHELL's own metadata, which is the root layout's defaults plus the
shell layout's noindex. By the time the page is interactive the head reads
`noindex, nofollow`, canonical `https://www.reely.space/`, and the site's
generic description, on every tail URL.

Google's own URL Inspection said it in one line, for a page crawled 22 Aug:

> Indexing allowed? **No: 'noindex' detected in 'robots' meta tag**
> User-declared canonical: **https://www.reely.space/**

Which is 9,274 "Excluded by 'noindex' tag", most of 6,961 "Duplicate without
user-selected canonical", and most of 10,203 "Crawled - currently not indexed",
from one cause.

Fixed in two places, because either alone would have left a window:

- **`hooks/use-served-metadata.ts`** — the shells write the head back from the
  payload they already fetch: title, robots, canonical, description, OG and
  Twitter. Each of the four shells already patched `document.title` alone, for
  this exact reason, with the same comment copied four times; nobody asked what
  else the same wipe had taken.
- **The shells no longer carry `noindex` in their HTML at all.** A meta tag
  travels with the body, and this body is served under real URLs. The bare shell
  URLs are noindex by `X-Robots-Tag` in `public/_headers` plus robots.txt —
  both of which stay with the URL. `/list-fallback` and `/profile-fallback`
  were missing from robots.txt entirely.

Verified after deploy with Search Console's live test on a page from the noindex
bucket: **"URL is available to Google — Page can be indexed."**

## Mistakes

- **We tested the bytes and never the page.** `pnpm seo:verify` fetches the HTML
  and reads the meta tags — the Worker's tags, which are correct. Googlebot
  renders JavaScript. Nothing on this project had ever looked at the head
  _after_ hydration, so a bug that only exists after hydration was invisible to
  every check we had, including the one written specifically to catch this class
  of problem. The whole diagnosis took one `document.querySelector` in a real
  browser.
- **The `document.title` patch was the bug report, four times over.** Each shell
  carried "the Worker injects the real title, but hydration re-renders the
  shell's own". That sentence is the entire root cause, written down, in four
  files. It was read as a title quirk instead of as what it is: hydration
  discards the served head.
- **build-worker.mjs's comment already named the Search Console bucket.** It
  says stripping the robots meta fixes "Excluded by 'noindex' tag" — and it did
  fix it, for the served HTML. The strip shipped, the bucket kept growing, and
  nobody went back to ask why.
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

- **Check the head Google actually files: the one AFTER hydration.** A static
  export that decorates a shell at the edge has two heads, and only the second
  one decides indexing. One line in a browser console.
- **A fallback page is not done when it unfurls. It is done when it has a body.**
  Compare it to a prerendered page by visible character count, not by which meta
  tags are present.
- **Never prerender a closed set from a list that moves**, and never put one in
  the sitemap. If the set has to be bounded, commit it.
- **Before adding a request, print the keys of the response you already have.**
- Related: [Bing said the h1 was missing](2026-08-29-bing-said-the-h1-was-missing.md)
  (the same block, the previous round), and `docs/marketing/launch-kit.md` for
  where the Search Console numbers came from.
