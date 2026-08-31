# Launch kit

Copy, assets and a submission list for putting Reely in front of people who are
not already searching for it. Same job as the one in the downloader repo, same
discipline: everything here is written once, and every listing pastes from it so
the product reads the same everywhere.

One constraint is not negotiable, and it is the one that decides whether a
directory moderator, a payment processor or an app-store reviewer reads this as
a product or as a piracy tool: **describe what Reely does — discovery, tracking,
and playback through a source you configure — never what a paywall loses.**

Do not paste anything below that contains "free movies", "watch full movies
free", "no subscription needed", "unlimited streaming", or the name of any
streaming service framed as something Reely replaces. The player is a
configurable external source with an in-app disclaimer; the product is the
catalog, the filters and the tracking around it. That framing is also the true
one — no provider host is checked into this repo.

## Copy, at the lengths listings actually ask for

**Name.** Reely
**URL.** https://www.reely.space
**Repo.** https://github.com/Vette1123/movies-streaming-platform (MIT)

**Tagline, 40 chars.**
Find what to watch, then keep track

**Tagline, 60 chars.**
Discover, filter and track movies and TV — no ads, no noise

**One-liner, 100 chars.**
Open-source movie and TV discovery app on TMDB — deep filters, ⌘K search, watchlist, installable.

**Short description, 160 chars.** (also the meta description)
Discover, track and stream movies and TV shows. Trending rails, deep live-applying
filters, ⌘K search, watchlist and history. Free, open source, installable.

**Medium description, ~300 chars.**
Reely is a free, open-source movie and TV app built on the TMDB API. Browse
trending and top-rated titles, narrow them with filters that apply as you move
them (genre, rating, runtime, year, language, certification, streaming provider),
search from anywhere with ⌘K, and keep a watchlist and watch history. Installs as
a PWA.

**Long description.**
Reely is a movie and TV discovery app: it answers "what should I watch" and then
remembers what you decided.

Every title in it comes from the TMDB API. The browse pages carry a filter panel
that live-applies on a 300ms debounce — sort, tri-state genre pills (include /
exclude / off), TMDB rating, vote count, runtime, release decade or year range,
original language, age certification, and a where-to-watch provider grid with a
region picker — and every filter is in the URL, so a filtered view is a link you
can send. Detail pages carry cast, trailers, similar titles, recommendations,
collections and a season-by-season episode navigator. ⌘K opens a command palette
that searches movies and TV as you type. There is a swipeable trailer feed, a
mood picker, and a shared pick-a-film mode for two people.

Watchlist, watch history and recent searches are kept in the browser; signing in
with Google is optional, free and only there to sync them across devices. It
installs as a PWA with a hand-written service worker, offline fallback and app
shortcuts. Playback happens in-page through an external source you configure,
behind an in-app disclaimer — Reely hosts no video.

The stack is Next.js 16 (App Router, RSC, Turbopack), React 19, TypeScript 6,
Tailwind CSS 4 and shadcn/ui, shipped as a static export on Cloudflare Workers
Static Assets with one hand-written Worker for search, filtering and tail ids.
Next.js does not run in production at all. MIT licensed.

**First comment** (Product Hunt, Show HN, StartupBase — the maker comment).
I kept opening three tabs to decide on one film: one to remember what a title
was, one to check whether it was any good, and one to write down that I had
already seen it. Reely is those three tabs.

It is a TMDB-powered browser for movies and TV. The filters are the part I
actually built it for — genre pills that can exclude as well as include, rating,
vote count, runtime, decade, language, age certification and which service has
it, all applying as you move them instead of behind a Save button, and all in the
URL so a filtered list is a link. ⌘K searches from any page. A watchlist and a
watch history live in your browser; you can sign in with Google if you want them
on your phone too, and that is the only thing an account does.

Playback is in-page through an external source you configure — Reely hosts no
video, and the disclaimer says so.

The architecture is the other half of the story: it is a static export on
Cloudflare Workers Static Assets, so Next.js does not run in production. Under
the previous OpenNext deployment, 20–46% of Worker invocations were killed on
the free plan's 10ms CPU budget; after the migration that is 0.0% and p99 CPU
went from ~700ms to ~8ms. One hand-written Worker serves the API and rewrites a
fallback shell for detail ids outside the prerendered set, so a crawler cannot
tell a tail page from a baked one.

MIT: https://github.com/Vette1123/movies-streaming-platform — happy to answer
anything about the static-export migration or the filter system.

## Where to submit, in the order worth doing it

### Tier 1 — worth the effort

| Channel                              | Why                                                                                                                                                               | Needs                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **GitHub topics + repo description** | 166 stars and 68 forks already; the repo is the strongest asset here and topics are how it gets found on GitHub itself.                                           | Repo access — done, see below  |
| **Awesome lists**                    | Permanent backlinks from repos with 10k–20k stars, and the audience is exactly the one that stars a Next.js app.                                                  | A PR each                      |
| **Google / Bing webmaster tools**    | The sitemap advertises ~14,900 URLs; the console is where you find out how many were actually taken.                                                              | Accounts                       |
| **AlternativeTo**                    | "alternative to \<tracker\>" is how this category is searched.                                                                                                    | Account                        |
| **Show HN / r/webdev / r/nextjs**    | The static-export-on-Workers migration (20–46% of invocations killed → 0.0%) is the story these audiences reward, not the app itself. Lead with the architecture. | Accounts, and each sub's rules |

### Tier 2 — cheap, low risk, small return

Product Hunt, StartupBase, SaaSHub, Indie Hackers, Uneed. All are forms; fill
them from the copy above. Every one of them asks for a claim in the owner's name
(launch date, solo founder, badge on the site) — fill the form, leave the claim.

### Not worth it

- **awesome-selfhosted** — requires a tagged release older than four months and
  disqualifies software bound to one cloud provider. Reely has no tags and is
  Cloudflare-bound.
- **enaqx/awesome-react** — the contributing note asks people not to use the list
  as an advertisement board for their own projects. It is a list of Mattermost
  and Kibana; a self-submitted app does not belong in it.
- **DevHunt** — developer tools only.

## Repo description and topics — already set

Description: "Reely — a fast, installable (PWA) movie & TV platform to discover,
track & stream films and series…"; homepage `https://www.reely.space`; 20 topics
including `nextjs`, `react-19`, `tmdb`, `cloudflare-workers`, `shadcn-ui`,
`tailwindcss`, `pwa`, `movies`, `tv-shows`. Nothing to do here.

## Submission status — 2026-08-31

| Channel                          | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **awesome-shadcn/ui** (20.4k ★)  | PR open: https://github.com/birobirobiro/awesome-shadcn-ui/pull/606 — Platforms section, alphabetical, no Date cell (their workflow stamps it).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **awesome-nextjs** (11.1k ★)     | PR open: https://github.com/unicodeveloper/awesome-nextjs/pull/577 — Apps section.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **awesome-cloudflare** (15.1k ★) | PR open: https://github.com/zhuima/awesome-cloudflare/pull/218 — Others / 其他, both the Chinese and English READMEs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Product Hunt**                 | Scheduled: launch Tue 8 Sep 2026, 12:01am PT. Gallery, tagline, description, four topics and the maker comment are already on the draft; the date is still editable from the launch page. Deliberately a week after the downloader launch so the two do not stack.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **AlternativeTo**                | Submitted, pending review (their backlog is months unless you pay $5 to jump it). Listed as **Reely (Mohamed Gado)** — the form refused the bare name because an unrelated app called Reely already exists; the change note asks a moderator to rename it. Thirteen alternatives suggested (IMDb, Trakt.tv, Letterboxd, Simkl, TMDB, JustWatch, Reelgood, Playpilot, Yamtrack, Serializd, Next Episode, CineTrak, Movary) — an app with no alternatives is invisible there.                                                                                                                                                                                                                                                                                                                                     |
| **Reddit**                       | Deliberately skipped — the account is under a sitewide spam filter (see the downloader lesson).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **awesome-pwa** (4.9k ★)         | PR open: https://github.com/hemanth/awesome-pwa/pull/486 — Games and Entertainment, alphabetical. Their CI fetches every listed URL with a Chrome UA and looks for a manifest link; ours answers 200 with `rel="manifest"`, so it passes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **GitHub release**               | v1.0.0 tagged and published: https://github.com/Vette1123/movies-streaming-platform/releases/tag/v1.0.0. The repo had no tags at all before this.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Peerlist**                     | Project page live: https://peerlist.io/boogado66/project/reely (100% complete — logo, two covers, five stacks, MIT repo). The weekly **Launchpad slot is used** by Masareef for week 36, so the launch itself has to be fired in week 37: Launchpad → Launch → pick Reely → Launch Project.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Launching Next**               | Form filled and waiting in a tab, unsubmitted: it ends in an arithmetic anti-spam question, which is bot detection and not mine to answer. Type the answer and press Submit. Free listing; a $99 upgrade is offered on the next page and is not worth it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Hacker News**                  | Blocked, not skipped. `Show HN` from a fresh account bounces to /showlim: "We are temporarily restricting Show HNs because of a massive influx." The title, URL and maker comment are ready above; the fix is an email to hn@ycombinator.com from the owner, or karma on the account first. Do NOT drop the `Show HN:` prefix to get around it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Google Search Console**        | Verified as `sc-domain:reely.space`. 30.9k indexed, 48.4k not — and three real bugs behind it, all fixed and deployed 31 Aug (see `lessons/2026-08-31-search-console-said-soft-404.md`): hydration was re-applying the shells' `noindex` and a homepage canonical to every tail page (9,274 "Excluded by 'noindex'"), the tail body was 1,393 visible characters of mostly site chrome (112 Soft 404, and most of the duplicate/crawled-not-indexed buckets), and the person set churned every deploy so indexed URLs 404'd. Validation restarted on Soft 404 and noindex; the 404 bucket is deliberately NOT revalidated — its remaining samples are titles TMDB itself deleted, so a 404 is the right answer. Live test on a bucket URL after the deploy: "URL is available to Google — Page can be indexed." |
| **Bing Webmaster**               | Already verified for reely.space, IndexNow wired. Nothing to do.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Everything else**              | Not attempted. SaaSHub and dev.to need a signed-in session that this browser does not have; uneed.best is refused by the browser extension. Indie Hackers and StartupBase are forms; fill them from the copy above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Related: `lessons/2026-08-31-marketing-round.md`, and the downloader's own kit at
`social-media-downloader/docs/marketing/launch-kit.md` — the channel-by-channel
notes there (Reddit's spam filter, Product Hunt drafts, the file-input traps)
apply here unchanged.
