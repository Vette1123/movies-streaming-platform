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
- **A per-image fallback needs a per-session breaker.** A quota outage fails
  every image for weeks; without a shared flag, each one re-pays the discovery.
- **When two probes of the same URL disagree, suspect the probe.** Re-read the
  string you actually sent before writing a theory about the server.
