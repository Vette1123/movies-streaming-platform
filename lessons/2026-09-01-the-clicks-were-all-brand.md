# The clicks were all brand, and the title could only match the title

**Date:** 2026-09-01
**Area:** marketing round three, SEO

## What

Third marketing round. It started as "open more list PRs" and turned into one
code change, because the measurement said the listings channel is spent and the
titles were the thing costing traffic.

Measured first, in this order:

- **Search Console, 28 days to 29 Aug:** 8.4k impressions, 264 clicks, average
  position 24.7, 945 queries. The clicks are brand — "reely movie" 40,
  "reely.space" 37, "reely space" 35. The title queries bring impressions and
  nothing else: "daddy's in trouble" 814 / 2, "to the max 2026" 190 / 0.
- **PostHog, weekly interacting users** (card clicks, plays, searches — not
  pageviews, which are ~97% bots here): 93 → 152 → 437 → 327 → 214 → 165 over
  the six weeks to 30 Aug. The peak was the last round of listings landing, and
  it decays without a new event.
- **The five awesome-list PRs from rounds one and two: all still open**, none
  merged, none commented.

So: `Daddy's in Trouble (2026) | Reely` can only match the bare title, which is
the query IMDb, Wikipedia and Rotten Tomatoes already own. Detail `<title>` now
carries the modifiers people type — `The Shawshank Redemption (1994) — Cast,
Trailer & Where to Watch | Reely`, `Game of Thrones (2011) — Seasons, Cast &
Where to Watch` — and `og:title` / `twitter:title` deliberately keep the plain
heading, because an unfurled card is a poster with a name under it.

`lib/seo-title.ts` gained `mediaHeading()` and `mediaDocHeading()`; the same
`year ? title (year) : title` ternary had been written out three times
(`lib/media-page.ts`, `app/media-fallback/page.tsx`, `cloudflare/worker.js`),
which is exactly how a tail page and its prerendered twin drift apart.

`docs/marketing/launch-kit.md` gained the numbers and a re-checked status table.

## Mistakes

- **Started the round by searching for more lists to submit to.** Twenty minutes
  of `gh search repos` produced two candidates, and reading them disqualified
  both: `officialrajdeepsingh/awesome-nextjs` (707 ★) lists libraries, not apps,
  and `pluja/awesome-privacy` (19.6k ★) would be a bad-faith entry while the
  site runs PostHog with session replay on. The right first move was the one
  taken second — open Search Console and ask what the last round actually
  bought. A channel is worth another round only if the last round moved a
  number.
- **Assumed the queued submissions had progressed.** They had not: AlternativeTo
  is still absent from its own search, OpenAlternative still says "preview only
  … not yet published". Both were checked in ten seconds and neither would have
  been, on the strength of "submitted 31 Aug".
- **Nearly wrote a blog to feed Hacker News and dev.to.** The migration numbers
  are a genuinely good post, and the post has nowhere to go: Show HN is
  restricted for this account, dev.to needs a sign-in the agent cannot do, and
  Lobsters is invite-only. Build the asset when the channel that consumes it is
  open, not before.
- **Considered a version floor (`Chrome < 130`) for the scraper rule.** It would
  have swept up Amzn-SearchBot and Claude-SearchBot, both of which send
  `Chrome/119`. See `lessons/2026-09-01-the-fleet-was-ten-strings.md`.

## What worked

- Counting humans by interaction events rather than `$pageview`. On this site
  the pageview number is 96,641 for 30 days and the interacting-user number is
  ~165 a week; a round judged on the first would look like a triumph.
- Splitting `<title>` from `og:title` instead of picking one. They have
  different jobs and the split is what let the search modifiers go in at all.
- Verifying the change where it is actually rendered: `curl` the dev server and
  read the three tags, rather than trusting that a metadata builder does what
  its name says.
- Recording the two disqualified lists in the kit with the specific rule that
  disqualifies them, so round four does not re-evaluate them. Same discipline as
  round two.

## Rules

- **Before another round in a channel, measure what the last one bought.**
  Search Console for search, interaction events for humans, `gh pr list` for
  PRs. "We submitted it" is not a result.
- **A `<title>` is a ranking input; an `og:title` is a caption.** Never let one
  builder serve both.
- Check a queued submission's public page before writing "submitted, pending" a
  second time — the queue's state is visible from outside.
- Do not build the artifact for a channel that is closed to you. Note it, and
  build it the day the channel opens.
- Marketing copy discipline covers the SERP title, which is rendered more often
  than any asset the site ships: "where to watch", never "watch free".

## Related

- `lessons/2026-09-01-the-fleet-was-ten-strings.md` — the invocation-budget work
  from the same session; the launch this round is preparing for is the day the
  cap would have been crossed.
- `lessons/2026-08-31-marketing-round.md`, `-marketing-round-two.md` — rounds
  one and two, and the copy rule.
- `docs/marketing/launch-kit.md` — the copy, the numbers and the status table.
