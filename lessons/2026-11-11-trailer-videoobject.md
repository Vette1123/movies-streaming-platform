# 2026-11-11 trailer VideoObject

## What

Search Console reported 583 pages with a video that is not indexed. The detail pages already carried a VideoObject, but only nested under the Movie/TVSeries `trailer` property, with a one-line boilerplate description. It is now also emitted as its own `application/ld+json` script (same `@id`, same builder), and the description comes from `mediaDescription`.

## Mistakes

- Read the brief as "build a VideoObject", but `trailerObject` already existed in `lib/structured-data.tsx`. The real gap was the standalone node and the description, so the diff is smaller than the brief implied.
- Edited files with a Python heredoc on Windows: it decoded the em dash as cp1252 and wrote U+FFFD into the trailer name. A test caught it. Use Edit for non-ASCII text.
- Reached for a whole-tree stash for the red/green check; the guard hook blocked it. Copy the old file over instead.

## What worked

- One builder feeds both the nested `trailer` and the standalone script, and a test asserts they are equal.
- Red check: put HEAD's `lib/structured-data.tsx` back, run the new test file, restore.

## Rules

- Grep for the thing before building it.
- The tail-id fallback (`cloudflare/worker.js`) gets no VideoObject: its summary payload has no `videos`, and adding them means the 98KB detail fetch that was removed on purpose.
- Whether Google now indexes the trailers is only known from the Video indexing report in a few weeks.
