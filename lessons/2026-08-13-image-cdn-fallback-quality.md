# Image CDN fallback quality — 2026-08-13

## What

The report: "when the ImageKit quota finishes we have a fallback image CDN, but
quality becomes so bad." Fixed the three things that actually made it bad, and
left a runnable check so nobody has to discover this during the next outage.

- `lib/image-loader.ts` now rewrites **wsrv.nl** URLs as well as ImageKit ones,
  so the fallback stage gets a real responsive `srcset` instead of one pinned
  width.
- `lib/tmdbConfig.ts` `buildWsrvURL` — one shared builder for the wsrv stage,
  now always sending `&we` (without enlargement).
- Circuit breaker: the first primary-host failure flips a module flag and every
  mounted `BlurredImage` re-renders straight onto the fallback, instead of each
  `<img>` paying its own doomed request.
- `scripts/check-image-fallback.mjs` (`pnpm images:check`, `--live`).
- `components/command-menu.tsx` had the same `onError` body twice; both now call
  the shared `handleImageFallbackError`.

Second pass, after "anything else to improve?":

- `c-at_max` on the ImageKit `original` transform — the **primary** path had the
  same upscale bug the fallback did, and it runs on every load, not just during
  an outage. 780 px source asked for `w-2560`: 30 060 B → 6 054 B.
- `image_host_fallback` PostHog event, fired once per session from a single
  subscriber in the provider.

Third pass, a full homepage image audit in headless Chrome (cold/warm at 390@3x,
764@1x, 1512@2x): caching is already perfect — every warm load is 100% cache
hits, 0 KB, HTTP/3, no duplicate URLs. Two payload gaps found and fixed: the
hero wordmark was the page's two heaviest files and still on `q-82` (it is the
one plain `<img>`, so the loader never retuned it), and the hero's cinematic
side poster was being eagerly fetched _and preloaded_ on viewports where its
`hidden lg:flex` wrapper makes it `display:none`.

## Mistakes

**Assumed the premise, then failed to reproduce it.** The whole first hour went
into "the fallback proxy produces worse images than ImageKit" — and it does not.
Measured on the same backdrop, wsrv and ImageKit return **byte-identical** WebP
at a matched width and quality (w1200 q65 → 10 678 B from both; q82 → 18 252 B
from both). If I had believed the report's causal story and gone straight to
"swap the fallback for a better proxy", I would have shipped a new dependency
and changed nothing. The symptom was real; the named cause was not.

**Wrote a broken probe and nearly filed a bug against ImageKit.** The first
measurement pass concatenated the size segment twice (`/w500/w500/abc.jpg`,
`/original/original/...`) and came back `400 Bad Request` for every ImageKit URL
— which looked exactly like "the account is out of quota", the thing I was
looking for. Confirmation bias found the evidence it wanted. What broke the
spell was that a second, _simpler_ curl of the same host returned `200`. Two
requests that disagree mean the requests differ, not the server.

**Then blamed the `Accept` header.** Between those two probes the only visible
difference was that one sent `Accept: image/avif,...`, so the next hypothesis
was "ImageKit 400s on an AVIF Accept". Tested it across four Accept values: all 200. Cheap to check, and it kept a wrong theory from reaching the diff.

**Wrote the self-check's expectation before deciding the function's contract.**
`demoteFromPrimary` was originally gated by the caller (the component checked
the flag, the function did not). The check asserted the self-gating behaviour
and failed. The test was wrong about the code, but the code had the worse
contract — a function that silently demotes even when nothing is down is a trap
for the next caller. Moved the gate inside. A failing check is a question, not
a verdict on which side is wrong.

**Fixed the fallback's upscale and did not check the primary for the same bug.**
`&we` went onto wsrv, the diff was written, the commit was made — and the
identical `w-2560`-off-`/original` enlargement was sitting in `originalImage`
the whole time, on the path every visitor loads every day. It only surfaced on a
follow-up "anything else?" question. When a class of bug is found in one branch
of a chain, grep the other branches before calling it done: the fallback and the
primary are both "an image proxy being told a width".

**Shipped a hair-trigger circuit breaker and it broke the page.** The breaker
tripped on the FIRST `error` event from the primary host, and every mounted
`BlurredImage` then re-rendered onto wsrv. Measured in a browser afterwards:
dispatching one `error` on one poster moved **17 of 20** homepage images off
ImageKit — every one already painted and warm in the HTTP cache. They all
re-downloaded from a cold host and replayed their blur-up. The user's report was
"I refresh and see image blanks, not cached", which is precisely that.

Two things were wrong and both are obvious in hindsight. `error` is not a signal
about the _host_: it fires for a poster TMDB no longer has, a request aborted by
navigating away, a content blocker, a dropped connection. And a global switch
had no business touching images that had already succeeded — the breaker's whole
job is to stop images that have _not loaded yet_ from queueing behind a dead
host. Now: three distinct primary URLs must fail, and an image with pixels on
screen is never demoted.

The deeper mistake is that this was the one part of the change that could only
be observed in a browser, and it shipped without one because the browser was
unavailable. "Can't verify it" should have meant "don't ship that part yet", not
"ship it and note the gap" — the URL-shape work was independently verifiable and
could have gone alone.

**Nearly shipped a width cut to the hero wordmark because the ratio looked bad.**
It measured 500 px of file into a 264 px box, and `w-320` was -42% against
`q-70`'s -12% — so width was obviously the lever. It is not: the logo is
`w-auto` under `max-h`/`max-w` caps, and above lg neither cap binds, so the
element lays out at the file's _intrinsic_ width (measured: a logo painting at
exactly 500 CSS px at 1512). A narrower file would have silently shrunk the
wordmark rather than sharpening it. "Natural width > box width" only means waste
for images whose box is set by CSS. Check which one is driving layout before
treating the ratio as a bug.

**The reflex to reach for the browser was right and unavailable.** Chrome needs
a one-time "Allow remote debugging?" click, and this session is non-interactive,
so the in-browser simulation (block `*ik.imagekit.io*`, watch the chain walk)
never ran. Said so rather than implying it passed. The URL-shape assertions and
live fetches cover everything except the React re-render path.

## What worked

- **Measure both sides before believing either.** Downloading the actual bytes
  from ImageKit, wsrv, and the TMDB origin at matched widths — and decoding the
  pixel dimensions — turned a vague quality complaint into two specific numbers
  (118 KB vs 4 KB; 45.8 KB vs 10.1 KB) that named the real defects.
- **The decisive experiment for the upscale was a smaller source.** Both proxies
  look fine when the source is 3840 px wide. Asking for w=2560 from a _w780_
  source is what exposed the enlargement, and `&we` fixing it confirmed the
  mechanism.
- **Bundling the real modules with esbuild for the check** instead of
  re-implementing the URL logic in the test. A check that copies its subject
  proves nothing.

## Rules

- **The report names the symptom, not the cause.** "The fallback CDN looks bad"
  meant "we ask the fallback CDN for the wrong width". Reproduce the symptom
  with numbers before accepting the user's (or your own) causal story.
- **A custom `next/image` loader must handle every host it will ever be handed.**
  A URL the loader passes through gets a `srcset` of identical candidates under
  different `w` descriptors — the srcset silently becomes a lie, and the site
  pins itself to whatever width was baked into the URL.
- **Never ask an image proxy to enlarge.** `original` is not a width. wsrv needs
  `&we`; check the equivalent for any proxy before making it a stage.
- **A per-image fallback needs a per-session breaker — with a threshold.** A
  quota outage fails every image for weeks, so a shared flag is right; but one
  `error` is not evidence a host is down, and the flag must never touch an image
  that already painted. A global switch that can be thrown by any single failure
  will be, by the noisiest thing on the page.
- **A change you cannot verify is a change you do not ship yet.** Split it out
  and send the part you can prove.
- **When two probes of the same URL disagree, suspect the probe.** Re-read the
  string you actually sent before writing a theory about the server.
