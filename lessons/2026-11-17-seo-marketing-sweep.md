# SEO and marketing sweep (2026-11-17)

## What

A read-only audit of the live heads and the source, then fixes:

- `/lists` left the sitemap: the Worker serves it `noindex, follow` while no list is published, which Search Console reports as "Submitted URL marked noindex".
- `/start` lost its fixed 2024-01-01 `lastmod`; omitted is honest.
- Person pages: "has been in" became "worked on" for people TMDB files under a crew department, and JSON-LD `jobTitle` is a job ("Director"), not TMDB's department ("Directing"). `personJobTitle` in `lib/seo-description.ts`.
- Title JSON-LD no longer carries `aggregateRating`. The only votes are TMDB's, and Google's review-snippet policy forbids marking up ratings aggregated from another site.
- `withSiteSocial` gives the twitter card one image; detail pages rendered two `twitter:image` tags (backdrop + poster).
- `endSentence` treats `…."` as ended; Star Wars' collection description read `…".`.
- Bingbot and DuckDuckBot moved to their own 10s crawl-delay group (Applebot stays at 20); a full pass over ~48,000 URLs went from 11 days to under 6. The Yandex-only `Host:` line is gone.
- Copy: `siteConfig.description` (the fallback meta description, WebSite JSON-LD and RSS channel) was a credit line with "tv" in lowercase; the press page said 16,000+ sitemap pages (it is ~48,000) and mislabelled its word counts; `/advertise` had a 233-character description.

## Mistakes

- The audit reported the collection description as 167 characters. It counted `&quot;` entities in the raw HTML; decoded it is 157 and inside the window. The real defect was the doubled punctuation. Measure decoded text, not markup.
- A regex used to strip a line out of a patch script also ate the closing backtick and paren of the call it sat in; the script stopped compiling. Edit source with the editor, not with a regex over a script that edits source.
- Not a mistake made, a call made: dropping `aggregateRating` gives up possible star snippets. Kept the visible scores; the risk was a manual action across ~48,000 pages.

## What worked

- Every fix is pinned by a test seen red on the old `lib/` files and green on the new: five failed, then all 83 in the three files passed.
- Checking the rendered head on the dev server (curl) rather than trusting the diff: one `twitter:image`, `jobTitle: Director`, the robots groups, the sitemap entries.

## Rules

- A sitemap URL must answer indexable. When the Worker can noindex a page, it does not go in the sitemap.
- No `aggregateRating` from TMDB votes; `tests/json-ld-escape.test.ts` fails if it returns.
- Copy that states a number (press page) names where the number comes from, so the next update is a lookup.
