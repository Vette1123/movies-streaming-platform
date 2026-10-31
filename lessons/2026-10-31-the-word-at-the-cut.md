# The word at the cut

## What

Worked through Bing Webmaster's report for this site.

- Long synopses cut on a word boundary could land at 148-149, under the 150 floor. A closing
  sentence now refills them, for titles and collections.
- `/press` was 199 characters. It is now inside the 150-160 window.
- Resubmitted the `www` sitemap to Bing. The `http://` and bare-domain entries redirect to
  `www` and inflate its count to 45.8K for about 15K pages. They are harmless and still listed.

## Mistakes

- **Treated "too short" as closed after 2026-10-09.** The floor was enforced for short
  synopses, and nothing covered a long one that a word boundary shrank.
- **Bing's list of 100 pages was stale.** Of the 25 shown, 23 were already in the window, so
  rewriting those pages would have fixed nothing. A sample of 424 live pages found the 7
  real ones.

## What worked

Measuring the live pages as bingbot before touching code.

## Rules

- A report names symptoms from its last crawl. Measure the live page first.
- After cutting text to a limit, check the floor too.
