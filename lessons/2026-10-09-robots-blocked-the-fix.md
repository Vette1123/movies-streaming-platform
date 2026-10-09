# 2026-10-09 — robots.txt blocked the fix

## What

Search Console, last update 4 Oct: **12.2k indexed, 74.9k not**. On 28 Aug
it was 28.3k / 50.7k. The bucket that moved was "Alternative page with
proper canonical tag", which went from 1.6k to 15k from late August on, and
its examples were ordinary tail pages (`/movies/16619`). URL Inspection gave
the answer: **user-declared canonical `https://www.reely.space/`**, crawled
6 Oct by Googlebot smartphone.

The chain:

1. A tail page is the exported `media-fallback` shell. Hydration re-renders
   the head from the shell's own metadata, which it inherits from the root
   layout: canonical = the homepage, hreflang en-US/x-default = the homepage.
2. `useServedMetadata` (31 Aug, `f2e5ad6`) writes the real head back, but
   only once `/api/media/<type>/<id>` returns.
3. `robots.txt` had `Disallow: /api/`. Googlebot's renderer honours robots
   for subresources, so that fetch never ran, and Google filed each tail page
   as a copy of `/`.

The same 31 Aug commit removed the shell's `noindex`, which is why the
noindex bucket froze at 12k (newest example crawled 31 Aug) at the same
moment the canonical bucket started climbing. One bug moved from one bucket
to the other.

Fixed three ways:

- `app/robots.ts` allows `/api/media/`, `/api/collection/`, `/api/list/` and
  `/api/profile/`. Each is longer than `/api/`, so it wins; the rest of
  `/api/` stays blocked. Pinned by `tests/robots.test.ts`, a longest-match
  evaluator over the real `robots()` output, which was red before the fix.
- `lib/shell-metadata.ts` sets `alternates: null` on all four shells, so
  hydration has no homepage canonical to put back.
- `useServedMetadata` writes the canonical from the URL on the first effect,
  before data arrives, and updates every match, not just the first.

## Mistakes

- **The 31 Aug fix was verified in a browser that could fetch `/api/`.** It
  was right in Chrome and wrong for the one client it existed for. A fix for
  what Googlebot renders has to be checked against what Googlebot is allowed
  to fetch, and robots.txt was in a different file.
- **I nearly called the served-HTML check conclusive.** curl and the
  post-hydration DOM were both clean. Only URL Inspection's "user-declared
  canonical" field showed what Google actually stored.
- **The first defence I tried (the early canonical write) lost a race in
  dev**: Next's metadata landed after the mount effect and left two
  canonicals. Removing the inherited canonical at the source held.

## What worked

- The `Last crawled` dates per bucket. 5xx examples are all 2–3 Aug (the
  migration day; that bucket is stale and shrinking), noindex all ≤ 31 Aug,
  canonical all October. Dates told live bugs from stale reports in minutes.
- Treating the shell's flight payload as part of the page. Grepping the
  served HTML for `canonical` found the homepage URL inside the RSC data.

## Rules

- Any data a page needs in order to describe itself must be crawlable.
  Check robots.txt before trusting a client-side head patch.
- A route served under URLs it does not own must not inherit the root
  canonical. Use `shellMetadata`.
- Read Search Console by `Last crawled` date before fixing a bucket: most
  "not indexed" counts are a snapshot of an older deploy.
