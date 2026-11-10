# Five notices that sat unread

**Date:** 2026-11-10
**Area:** `config/blocked-titles.json`

## What

Google Search Console forwarded five more copyright notices for reely.space: three
on 8 Nov and two on 9 Nov. Playback for all five is now disabled with
`pnpm takedown`, which records Google's reference ids and the Lumen numbers:
`/tv-shows/9573`, `/movies/508883`, `/tv-shows/300727`, `/tv-shows/298610` and
`/tv-shows/337277`. The pages stay up without a player. Nine titles are now blocked.

## Mistakes

The notices sat in the inbox for one to two days. They were found by a Masareef
marketing session that happened to read the inbox, not by anything watching for
them. "Expeditious" was met by luck.

The emails do not name the complainant. Lumen posts the notice weeks later, so the
entries say "not named in the Google notice (Lumen pending)" instead of a guess.

## What worked

- Collecting the URL, reference id and Lumen number from each Gmail message with
  one script, rather than reading five emails by eye.
- Following the 30 Oct lesson: no reply to `sc-noreply@google.com` and no appeal.

## Rules

- Search Gmail for `"copyright-related content" reely` whenever any session
  reads that inbox, and act the same day.
- Leave the complainant as "not named" until the Lumen entry is live, then
  correct it.
