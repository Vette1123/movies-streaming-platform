# The score measured my connection

## What

Lighthouse on the homepage, after the first-paint work. Rails stop hydrating
during load (#129), one hero slide until load and a width srcset for the
wordmark (#130), a 3:5 wsrv crop for portrait phones (#131), and `pnpm
lighthouse` with a data-centre workflow (#132).

From GitHub Actions: desktop 99, mobile median 73-80 (60-96 across runs, LCP
2.6-5.2s, first paint ~1.2s, TBT under the limit in most runs, CLS 0). Real
phones on `/`: LCP p75 2.2s before, 1.2s during the day's fixes on 8 samples.

## Mistakes

- Chased local scores for most of the day. A 500-830ms TTFB and a 1.4s stylesheet
  were this PC's link to the MRS colo, and local desktop read 61-76 against 99
  from a data centre.
- Compared single runs before that, which swing 10 points.
- Assumed the hero was late, and planned to serve it from our own origin. The
  timing output showed it finished at 180ms, ahead of the scripts. Nothing built.
- Assumed slow HTML for the 2.6s first paint. The trace showed the body landing
  in 20ms and the parser waiting on the stylesheet.
- Assumed hydration held the first frame on mobile. The main thread was idle: it
  was the GPU process on a machine with no GPU.
- `<picture>` silently removed the hero's preload, because React's automatic
  image preload skips it. Caught by reading the tags, not by a test.
- The first crop measurement compared 828x1472 with a 675px-tall file, and looked
  like a loss.
- `--force-with-lease` on a feature branch, and a background watcher that died on
  one GitHub 502.

## What worked

- Measuring every theory before building on it: three in a row were wrong.
- wsrv `fit=cover` for phones: 72-75% fewer bytes, sharper than the file it
  replaced.
- Reading the tags and an iframe at 412x823 for a phone viewport: one hero file,
  31KB, no double download.
- Real-user `$web_vitals` as the judge once the lab score stopped moving.

## Rules

- Judge a Lighthouse change by medians from the workflow, never from a home
  connection.
- Mobile LCP in simulate is a race: scripts finished before the observed paint
  are all charged to LCP. Do not hold scripts back from real people to win it.
- Anything moved into `<picture>` needs its preload written by hand, with `media`
  on every preload.
- A `<source>` outranks the `<img>`, so a fallback has to remove it.
- `w-auto` plus width descriptors means `sizes` sets the layout width.
- Real-user vitals outrank the lab score.
