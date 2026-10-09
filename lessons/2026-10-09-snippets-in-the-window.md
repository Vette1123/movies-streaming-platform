# 2026-10-09 — Every snippet in the window

## What

Bing Webmaster → Recommendations: **95 pages "meta description too short"**
(Moderate) and **1 "title too long"** (High, `/tv-shows/331756`, 91
characters). Bing's export lists 50 sample URLs, so I measured production
across every hand-written template rather than fixing the sample:

- 31 of 35 genre hubs at 132–149, all 72 year hubs at 129, `/movies` 115,
  `/tv-shows` 128, eight feature/legal pages at 104–145.
- The homepage at 171, and person pages anywhere from 129 to 225.
- Tail detail pages showed the root layout's 59-character description in
  Bing's render, for the same reason Google saw the homepage canonical: `/api/`
  was blocked ([[2026-10-09-robots-blocked-the-fix]]).

The fix:

- `lib/seo-description.ts` now aims for 150–160 (`MIN_LENGTH` / `MAX_LENGTH`).
  Offers are graded at most ten characters apart, and `bestOf()` tries the
  richest head first (synopsis + fact line, then the synopsis alone; three
  credits, then two, then one). `genreDescription` and `personDescription`
  moved there so they use the same mechanism.
- `mediaDocHeading` drops "Seasons, Cast & …" to "Where to Watch", then to
  the bare name, to keep the whole `<title>` within 70. It never cuts the
  name itself.
- Every hand-written description was rewritten into the window, each one
  measured.
- `pnpm seo:verify` now asserts 150–160 and ≤ 70 on every template.

## Mistakes

- **The first offer list had gaps wider than the window.** Offers of
  122/80/53 characters guarantee short output for any head that falls between
  two of them. "Pick the longest offer that fits" only holds a floor if
  neighbouring offers are closer than the window is wide. The script that
  walked every head length found that in seconds; eyeballing never would have.
- **Measured with bash `${#var}`, which counted bytes.** Every em dash read
  as three characters, so `/mood` looked like 164 when it was 160. Measure
  with node.
- **Read a 500 from a stale dev server as a code failure.** Port 3123 was
  still held by the previous session's server, whose render worker had died
  ("Jest worker encountered 2 child process exceptions"). Kill the port, not
  just the task.

## What worked

- Sweeping production for every non-detail sitemap URL turned a 50-URL sample
  into the real list of templates, about 90 pages.
- Tests that walk the input space (every genre, title lengths 1–60 ×
  synopsis lengths 0–260, franchise name lengths) instead of three examples.

## Rules

- A "longest that fits" list needs neighbours closer together than the target
  window. Test it by walking every head length.
- Any new page that writes its own `description` belongs in `seo:verify`'s
  `SNIPPET_PAGES`.
- Measure string length with JS, never `${#var}`.
