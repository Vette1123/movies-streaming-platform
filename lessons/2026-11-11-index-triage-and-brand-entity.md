# Index triage, and a brand entity that names the spellings people type

## What

- Search Console, Reely, every "not indexed" bucket drilled by sample date:
  - noindex 6,675: 997 of the 1,000 samples were crawled in August, before the static export; the live pages say `index, follow`. The other 3 are `/kodi`, `/stats`, `/account`, all deliberate. Started a new validation (11-11).
  - 404 872: every sample from October/November is either a TMDB id that TMDB itself now 404s, or a `/person/` id that `data/people.json` gained on 11-09 (#166), after Google's 7 Nov crawl. Started a new validation (11-11).
  - Google chose a different canonical 609: crawled 6-7 Nov, the ~600 tail pages the 11-09 hydration fix covers. Live pages carry the self-canonical and the `<article>` block.
  - Soft 404 83: all March to 1 August. Validation already running.
  - Redirects: apex to www, by design.
- Performance: "reely space" ranks 1, bare "reely" 43, "reely tv" 4.8 with no clicks. `WebSite.alternateName` repeated the name, and `Organization` had no `sameAs`. Now `alternateName` is `['Reely Space', 'reely.space']` and `sameAs` is the product's GitHub repo and Product Hunt page (`BRAND_PROFILES`). The builder's own accounts stay on `founder`.
- PostHog: no open errors. The Reely Player's 55% failure rate is 10 plays: one person retrying one title with no stream. `player_failed.no_stream` looked broken, but the property only shipped on 11-10 (#170), after those failures.

## Mistakes

- I nearly "fixed" the `no_stream` analytics flag. The message order in the player was right; the events just predate the property. Check the property's first commit date against the event dates before calling missing data a bug.
- My first read of the 404 list split `/person/1019` + `7 Nov` into `/person/10197`, and I nearly chased a person id that does not exist. Read table cells, not a row's flattened text.

## What worked

- Grouping drilldown samples by last-crawl month. A bucket whose samples all predate a known fix is a validation to restart, not a bug to hunt.
- Checking each 404 against TMDB's own API: a 404 there makes ours correct.

## Rules

- In Search Console, date the samples before reading the count. "Failed" validation on samples from before the fix just means restart it.
- `alternateName` is for the spellings people actually search; never repeat `name` there.
