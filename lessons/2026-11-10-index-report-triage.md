# Index report triage: every bucket was already fixed or intended

## What

Walked every "Why pages aren't indexed" bucket in Search Console for reely.space and socialdownloader.space, opened the example URLs, and checked each against production with a Googlebot UA. No code change was needed. Every bucket traced to a fix already on main or to intended behaviour:

| Bucket (Reely)                              | Pages  | Cause                                                                                                                                        | State                                                                                                                |
| ------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Duplicate, Google chose different canonical | 609    | `movies/1048178` folded into unrelated `tv-shows/310970`: Google rendered only the skeleton after React #418 deleted the Worker's SEO block  | Fixed 11-09 (#166). Live test: rendered HTML has the `<article>`, h1 and 25 title mentions. Validation started 11-09 |
| Crawled - currently not indexed             | 13,344 | Samples crawled 11-08, the day before #166; same thin-render cause                                                                           | Validation started                                                                                                   |
| Alternative page with proper canonical      | 15,040 | Newest crawl 10-09, before the 11-06 canonical fix; samples are self-canonical now                                                           | Validation started                                                                                                   |
| noindex                                     | 6,675  | Movie/TV samples last crawled 08-31 and serve `index, follow` now; `/stats`, `/account` private; `/kodi` noindex since it was created (#123) | Stale + intended                                                                                                     |
| 404                                         | 872    | Deleted TMDB ids (TMDB also 404s) and Freebase `/m/` paths; three real people were outside `data/people.json` 10-20 to 11-09                 | Correct 404s; people restored by #166                                                                                |
| Soft 404                                    | 83     | Apex URLs last crawled in July; apex 301s now                                                                                                | Stale                                                                                                                |
| Page with redirect                          | 7,966  | Apex → www                                                                                                                                   | Intended                                                                                                             |

Downloader: 14 of 19 "crawled, not indexed" are images (splash, favicon, OG cards). Two of the five pages (`twitch-clip-downloader`, `ar/facebook-downloader`) were already on Google when inspected; `pt/video-downloader` and `id/reddit-video-downloader` were sent to the priority crawl queue. `/?url={search_term_string}` and `/?url={url}` are leftovers of the JSON-LD templates removed in #32 and pinned by a test. `/account` noindex and the `/api/auth/google` robots block are intended.

## Mistakes

- Took the person 404s for a regression of the 11-03 transient-failure fix before checking `data/people.json` history. They had simply been dropped from the set for three weeks.
- Search Console's "last crawled" column was the deciding fact in every bucket and the report's headline numbers hid it. Reading counts alone would have restarted the 09-19 work.

## What worked

- Sorting every bucket's examples by last crawl date against the merge dates of the fixes.
- URL Inspection "Google-selected canonical" named the real cause (an unrelated title) in one click; "Test live URL" plus the rendered HTML proved the fix from Google's own renderer, not from curl.

## Rules

- Before fixing an index bucket, compare its newest "last crawled" date with the merge date of the last fix in that area. Older crawls are history.
- A Google-selected canonical that points to an unrelated page means Google saw two pages as the same document, so check what the rendered DOM contains, not just the served HTML.
