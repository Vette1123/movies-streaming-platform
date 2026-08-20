# Public profiles and a release-radar feed

## What

Two of the twelve supporter features from the same wave.

**`/u/<handle>`** — a public profile. Migration `0005` adds `users.handle` (UNIQUE),
`users.profile_public`, `users.profile_bio`; `lib/profile/routes.ts` holds the
pure `normaliseHandle`/`normaliseBio` plus `loadPublicProfile`; the Worker's
`handleProfilePage` decorates a new `app/profile-fallback` shell exactly the way
`handleListPage` decorates the list one. A supporter claims a name in a new
**Public page** section of the account console and flips one switch to publish.

**`/api/calendar/<token>.xml`** — the same watchlist schedule as RSS.
`lib/upcoming/rss.ts` is a second pure renderer over the rows
`loadUpcoming` already returns; the route dispatches on the extension.

Also: `SupporterBadge`, `StrangerPitch` and `PosterTile` extracted so the list
page and the profile page share them, and `loadPublicList` now returns
`owner_pro` so a published list carries the badge too.

## Mistakes

**The bio was going to live in `users.prefs`, which would have deleted itself.**
It was written that way first. `handleAccount` (`/api/account`) rewrites the
whole `prefs` JSON from `normalisePrefs`, an allowlist — so the first time
somebody changed their accent colour, their bio would vanish, with nothing in
the logs and no way to guess why. Caught before applying the migration, but only
by reading `handleAccount` while wiring the panel, not by designing it. **A JSON
blob that one endpoint rewrites wholesale is not a place to put a second
feature's field.** It got its own column.

**The RSS feed nearly got its own path prefix.** `/api/feed/<token>.xml` was the
obvious shape. It would also have needed its own WAF exemptions — the UA
challenge and the apex→www redirect both have to be off for a machine poller,
and `CALENDAR_PREFIX` in `scripts/cf-waf-setup.mjs` is where that lives. A
second prefix is a second rule to forget on the next `pnpm waf:apply`. It shares
`/api/calendar/` and dispatches on `.ics` vs `.xml`, so the exemptions that
already exist cover it.

**Three near-identical blocks nearly shipped.** The profile page wanted the
poster tile, the "what is Reely" pitch and the supporter badge that the public
list page already had. Copy-pasting was the fast move; the second occurrence is
where the DRY rule bites. Extracting `PosterTile`, `StrangerPitch` and
`SupporterBadge` made the list page shorter than it was before.

**`<title>` came out as a bare personal name.** `serveShellFromTemplate` builds
the title, `og:title` and the crawlable `<h1>` from `meta.heading` — `meta.title`
is carried on the object but never read by `metaTags`. So the carefully written
`${who} on Reely` went nowhere and a shared link read as just a name. Found by
curling the running Worker, not by reading the code.

## What worked

- **Copying `handleListPage` beat designing a route.** Path regex, shell
  constant, decorate-and-stream, `notFoundAsset` on a miss — the whole page cost
  about forty lines because the pattern was already there and correct.
- **A profile writes nothing.** Counts are one `GROUP BY` over `sync_items`; the
  top-rated titles are `ORDER BY json_extract(payload,'$.rating') DESC LIMIT 8`
  so SQLite sorts thousands of rows and the Worker parses eight; the lists are a
  row the list feature already keeps. No new write path means a profile cannot
  drift out of step with the account.
- **One 404 for three different situations** — unclaimed handle, unpublished
  profile, lapsed support. Separating them would tell a stranger which handles
  exist.
- **Verified against the real Worker**: seeded a supporter into local D1, ran
  `wrangler dev`, and checked `/api/profile/gado`, `/u/gado` (title, `og:*`,
  ProfilePage JSON-LD, the crawlable `<h1>`), the 404 on an unknown handle, the
  RSS document and the `.ics` still beside it. `pnpm dev` cannot do any of this:
  there is no Worker in it.

## Rules

- **A field belongs in its own column if any endpoint rewrites its blob from an
  allowlist.** Check who writes the JSON before adding a key to it.
- **A new public path is also a new WAF decision.** Prefer an extension on a
  prefix that already carries the exemptions a machine poller needs.
- **`meta.heading` is what a fallback page actually renders** — title, og:title
  and the crawlable h1. `meta.title` is decorative. Curl the Worker and read the
  tags rather than trusting the object you built.
- **Second occurrence, extract.** The list page and the profile page are the
  only two "a stranger opened this" surfaces on the site; they share their tile,
  their pitch and their badge, so those live in one file each.
