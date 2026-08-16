# Up next, a year card, and a pitch that names all of it

**Date:** 2026-08-16

## What

Two supporter features and the advertising for the whole set.

- **Up next** (`/account#next-up`, `lib/nextup/*`) — every show in progress, the
  exact episode you are up to, a progress bar, and a link that opens the player
  on it. Progress comes from the finished-episode rows already in `sync_items`,
  so nothing new is tracked and nothing has to be set up. The only outside call
  is the series shape, through the governed TMDB client on the same six-hour
  cache the alert sweep uses, capped at twelve shows a request.
- **Your year, as a card** (`lib/stats-card.ts`) — the stats page numbers drawn
  onto a 1080×1350 canvas in the browser, shared through `navigator.share` where
  a file share exists and downloaded everywhere else.
- **The support page** now leads with one full-width unlock rather than two
  half-width ones, carries ten of them, and every one is written as what it does
  on a Tuesday evening rather than as a feature name.

## Mistakes

- **Two features were proposed that already shipped.** "Shared list links" and
  "export your data" were both offered as the obvious next builds. Lists have
  had publish/unpublish and a public `/l/<slug>` page since the accounts work,
  and `DataPanel` has had a full JSON export the whole time. Both were proposed
  from a memory of the codebase rather than from a look at it, in the same
  conversation, twice. **Before proposing a feature, grep for it.** The cost is
  one search; the cost of not doing it is a plan built on a false inventory.
- **The stats feature was also already there** — `lib/stats.ts` with
  `computeStats`, tested, and a `/stats` page. The genuinely new part was the
  shareable card, which is a fifth of the work that was being scoped.
- **The supporter branch of `/support` was never looked at.** Its panel used
  `py-16` where the pitch beside it uses `pt-24 lg:pt-28`, so the card's top
  border sat under the sticky header — for every supporter, since the panel
  shipped. The pitch branch was screenshotted every time because that is the
  branch a signed-out browser renders. **A page with a signed-in branch has two
  designs, and the one you cannot see locally is the one that ships broken.**
- **`nextEpisode` was nearly "the one after the highest watched".** That marches
  somebody past everything they have not seen the moment they watch one episode
  out of order — which people do constantly, out of curiosity or because a
  friend said to. The first gap is the correct answer and it is self-correcting.
  Pinned in `tests/next-up.test.ts`.
- **Season 0 nearly got offered.** TMDB files specials there. A show with
  unwatched specials would have permanently suggested a Christmas episode from
  2011 as the thing to watch next.

## What worked

- **Reading the database before designing.** Twice now the cheap version of a
  feature existed because the rows were already there for another reason — the
  calendar from the alert sweep, and this queue from the episode ticks. The
  expensive-looking feature keeps being the cheapest one on the list.
- **The first-gap rule, with the walk in a pure module.** Progress arithmetic is
  the kind of thing that is confidently wrong and never reported, because its
  only symptom is a spoiler.
- **Counting the grid before adding to it.** The unlock grid's rule is "hero
  plus multiples of three"; ten entries fit it exactly, and the count was
  checked in the browser (`articles: 13`, first card 1215px, rest 394px) rather
  than assumed.

## Rules

- **Grep before you propose.** A feature suggestion is a claim about what the
  codebase does not have, and it should be checked like one.
- **The next unwatched episode is the first GAP, never the highest plus one.**
- **Skip season 0.** Specials are not the next episode of anything.
- **Every page with a signed-in branch gets checked in both branches**, even
  when only one of them can be rendered locally — read the other one's code.
- **A canvas beats an image endpoint** for anything built from data already on
  the page: no invocation, no fonts to fetch, works offline, and nothing about
  what somebody watches is sent anywhere to draw it.
