# The ratings-and-people kit — 2026-10-20

What shipped today, and how to say it out loud. The launch kit in the parent
directory is the long-form submission document; this is the short one, for the
thing that just changed.

## The hook

**Every title page now shows four scores — IMDb, Rotten Tomatoes, Metacritic
and TMDB — and every actor on it has a page of their own.**

The first half is the news: a free movie/TV tracker that shows what Rotten
Tomatoes and Metacritic think, next to IMDb, with no paywall and no account.
The second half is the quiet one: 764 people now have a filmography page, and
every name on a movie page is a link instead of a dead end.

## The posts

**X / Bluesky (one post, the ratings)**

> Every movie page on Reely now shows four scores: IMDb, Rotten Tomatoes,
> Metacritic and TMDB. No account, no paywall, no "sign up to see the rating".
>
> It runs on IMDb's free dataset and OMDb's free tier, so it costs us nothing
> to show and nothing for you to unlock.
>
> reely.space/movies/278

**Reddit (r/movies, r/ MovieSuggestions — the person pages)**

> We just gave 764 actors and directors their own pages on Reely, built from
> the cast of the films we actually carry. So if a name is on a movie page
> here, clicking it now takes you to everything else they're in, instead of a
> dead end.
>
> It came out of a small thing: our set of people with pages was TMDB's
> "popular" list, which is mostly people in films we don't have. The cast of
> our own catalogue is 33,000 people. We took the 764 who carry the most
> attention.
>
> reely.space/people

**Hacker News (the engineering)**

> We show IMDb, Rotten Tomatoes, Metacritic and TMDB on every title page, and
> it costs us nothing per request.
>
> The interesting part was the budget: Rotten Tomatoes has no free official
> API, and the one free source that has it allows 1,000 requests a day. We
> render about a thousand pages, four times a day. So the ratings live in the
> repository, the build reads that file, and a command refreshes it. A build
> makes zero requests; the quota is spent once, deliberately, by a person.
>
> The other half is 764 person pages built from our own cast lists — 33,000
> people, of whom the top 764 fit the asset budget.

**LinkedIn / Facebook (the product)**

> Two things went out on Reely this week.
>
> One: every movie and series page now carries IMDb, Rotten Tomatoes,
> Metacritic and TMDB side by side, with the vote counts. Free, no account.
>
> Two: every actor and director on a title page now links to their own
> filmography. 764 of them, chosen from the 33,000 people in our catalogue by
> how much attention their work carries here.
>
> Both were about the same thing: the page you land on should be the end of
> the question, not the start of another search.

## The search play

The pages we now answer, that we did not answer before:

| Query                           | The page                                                                  |
| ------------------------------- | ------------------------------------------------------------------------- |
| `<actor> movies`                | `/person/<id>` — the filmography, 764 of them                             |
| `<title> rotten tomatoes score` | `/movies/<id>` — the Tomatometer in the HTML, next to IMDb and Metacritic |
| `<title> metascore`             | the same page                                                             |
| `<title> imdb rating`           | the same page, with the vote count                                        |
| `<director> filmography`        | `/person/<id>`                                                            |

The person pages were the biggest gap: every title page named a cast member,
and almost none of those names had a page here. They are in the sitemap
(15,962 URLs, 764 of them people), they carry Person + ItemList structured
data, and each one's title names their three most-watched titles.

## The measurement

What to watch, and where:

- **Indexed person URLs** — Search Console → Pages → filter by `/person/`.
  The target is that the indexed count climbs toward 764.
- **`<actor> movies` impressions** — the query class the person pages exist
  for. It should show up in Search Console → Performance → Queries.
- **The rating pages' engagement** — PostHog: `media_detail_viewed` on a
  details page, and the click-through to a person page. The link from a title
  page to a cast member is the funnel this feature is for.

## The honest limits

- The person pages cover 764 people, not 33,000. The cap is Cloudflare's
  20,000-file asset limit on a static export, and a person page costs about
  six files. The set grows by refreshing it; it does not shrink.
- Rotten Tomatoes and Metacritic come from OMDb's free tier, so a title
  OMDb does not know shows the other two scores and no more. Nothing on the
  page is ever wrong; some of it is simply not there.
- The ratings are baked into the prerendered pages. A title outside the
  prerendered set (the long tail) has no ratings, because the fallback shell
  is a minimal page and there is no free way to ask OMDb per request without
  spending the day's quota on the first visitor.
