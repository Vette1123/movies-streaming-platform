# README film as an inline player

## What

The README linked the film as a poster image pointing at `docs/films/*.mp4`. GitHub
renders a committed `.mp4` only as a file page, and on mobile that page says the file is
too big to show, so the film never played. The fix copies `tarmeez-ai/hader`: the film is
uploaded as a GitHub attachment (drop it into a PR comment box, take the
`user-attachments/assets/<id>` URL, discard the comment), and that bare URL sits on its
own line, which GitHub renders as its own video player on desktop, mobile and in the app.
The in-repo files stay, linked with `?raw=true` so a tap plays the file itself.

## Mistakes

- The first version shipped a poster linking to the repo file and was never opened on a
  phone. A README check means opening it on GitHub mobile, not reading the Markdown.
- An autoplaying animated WebP was half built before checking how hader already did it.
  Look at the repo the owner names before inventing a route.

## What worked

- Attachments cap video at 10 MB on a free account. A two-pass x264 encode at 2.65 Mbps
  plus 160 kbps AAC kept 1080p60 and all 1560 frames at 8.9 MB.
- The new React issue form builds its file input on click (native picker); the classic
  PR comment box keeps `#fc-new_comment_field`, which takes an upload directly.

## Rules

- A README video is a `user-attachments` URL on its own line, under 10 MB.
- Link committed media with `?raw=true`, never the blob page.
