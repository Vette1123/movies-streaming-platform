// The committed ratings snapshot: the floor under the details page.
//
// OMDb's free tier allows 1,000 requests a DAY. The details build renders
// about a thousand pages, four times a day, so a build that fetched every
// rating every time would spend the whole quota on the first run and fail
// every day after it. The disk cache and the CI cache solve that for the
// titles we have already looked up — but a cache is a cache: it can be
// evicted, a workflow change can orphan it, and a title nobody looked up yet
// has nothing at all.
//
// This file is the answer to that. It is a plain map in the repository, so:
//
//   - the build NEVER needs OMDb. No key, no quota, no network, no failure
//     mode. A details page shows its ratings whether OMDb is up, down, over
//     its daily limit, or gone.
//   - the ratings are facts about films, not secrets, so a public repository
//     is the right home for them — the same reason IMDb's own dataset is
//     public.
//
// `pnpm ratings:refresh` is the only thing that writes it: it asks OMDb for
// the titles the build asked about (and for the ones already here, to keep
// them current) and merges the answers in. The diff is reviewable, and the
// file grows on its own as the catalogue does.
//
// The shape: IMDb id → what OMDb knows about that title. A missing id is a
// title we have not looked up; the page falls back to the IMDb dataset's own
// score and TMDB's, which cost nothing.
export interface MediaRatingEntry {
  /** Rotten Tomatoes critic score (the Tomatometer), 0-100. */
  rt?: number
  /** Metacritic score, 0-100. */
  mc?: number
  /** IMDb's score out of 10 — OMDb's copy, which is what the site shows. */
  imdb?: number
  /** How many people voted on IMDb, as OMDb writes it ("3,235,958"). */
  votes?: string
}
