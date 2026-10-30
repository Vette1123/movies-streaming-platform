# Three notices through Google

**Date:** 2026-10-30
**Area:** `config/blocked-titles.json`

## What

Google Search Console forwarded three notices from comeso GmbH (claims dated
29-30 Oct): `/movies/39108`, `/movies/1230213`, `/tv-shows/102088`. Playback for
all three is disabled with `pnpm takedown`, recorded with Google's reference ids
and Lumen numbers. Gmail held exactly these three, no others.

## Mistakes

`pnpm install` in the fresh worktree rewrote `pnpm-lock.yaml`; caught in
`git status` and reverted before the commit. Two Search Console URLs were guessed
and both 404'd; Gmail search was the reliable way to count the notices.

The first production check read `notice_hits=0` on all three pages and looked like
a failed block. They are tail pages: the hero renders in the browser, so curl can
never see the notice. Verify a tail page in a browser, and use the 451 from
`/api/pro/ticket` for the server half.

`/tv-shows/102088` then showed "Updating to the latest version" in Chrome, and I
blamed the service worker's saved copy. Deleting that entry changed nothing. The
real source was the browser HTTP cache: `max-age=3600` on the Worker's fallback HTML
kept the copy fetched before the deploy, with chunks that no longer exist, and the
service worker re-saved it on each visit. `fetch(path, { cache: 'reload' })` cleared
it. Anyone who opened a tail page in the hour before a deploy can hit this.

Our deploy was cancelled twice because other sessions pushed to main right after the
merge (`cancel-in-progress`). Follow the newest run, not the run for your commit.

Fixed the same day: Worker fallback HTML now sends the `max-age=0` header that
`public/_headers` gives prerendered pages, pinned by
`tests/fallback-html-cache.test.ts`.

## What worked

- Checking each reported id against the live page title before blocking.
- Re-checking the paths added since September: Kodi and the trial both go through
  `/api/pro/ticket`, and the 451 sits ahead of the trial check.

## Rules

- A Google notice has no reply address: `sc-noreply@google.com` discards mail.
  The only channels it offers are the appeal form and the complainant's contact on
  the Lumen entry.
- An appeal is a sworn counter-notice. Do not file one for a title the site really
  was playing without a licence.
- Say a title is disabled only after the deploy is verified.
