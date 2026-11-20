# GitHub repo SEO for Reely and SMD (2026-11-20)

## What
- Descriptions rewritten keyword-first (SMD 267 chars, Reely 282; limit 350), claims checked against the live site.
- Topics swapped from tech stack (shadcn-ui, radix-ui, react-query…) to what people search (movie-tracker, watchlist, kodi-addon; telegram-downloader, no-watermark). Cap is 20.
- Social preview set to the live OG card on both repos; SMD's README image was a July screenshot naming 5 platforms, now the current card. Reely's README badge said TypeScript 6 (it is 7).

## Mistakes
- Tried to set the social preview by assigning `input.files` and dispatching `change`/`drop` from page JS: GitHub's `<file-attachment>` ignored both, silently.
- `git add README.md docs/social-preview.png` in Reely failed on the missing path and staged nothing, so the first push had no commit.

## What worked
- There is no API for the social preview. Chrome's `file_upload` tool on the hidden `#repo-image-file-input` uploads and saves in one step; `gh repo view --json openGraphImageUrl` confirms the URL changed.

## Rules
- After any OG redesign, re-upload the GitHub social preview; it does not follow the site.
