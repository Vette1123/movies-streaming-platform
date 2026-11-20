# Promo film (Remotion, 60 fps)

## What

A 26-second film about Reely in two 60 fps cuts (1920×1080 and 1080×1920) from a
self-contained `video/` package, published to `docs/films/` and linked from the README with
a poster frame. Seven scenes on a 120 BPM grid: the endless scroll, the drop on the mark,
discover, a title page with all four ratings and Save, tracking, three promises, the outro.
Built from the Social Media Downloader film's package (same kit, beat and render script).

## Mistakes

- The first capture ran against production. Title pages came back as Cloudflare's
  "Performing security verification" page: the WAF flags headless Chrome. The fix is to
  capture `pnpm dev`, the same app with no WAF, never to get past the challenge.
- The image-ready check counted every image whose top was on screen, including a rail's
  off-screen cards to the right. Those are lazy, never load, and the shot timed out. The
  check now needs the image inside the viewport on both axes.
- The desktop hero autoplays a trailer, so the first capture got a random video frame.
  `reely:hero-autoplay = off` is preset before any page script; the install prompt's
  dismiss key too.
- "No ads" was a candidate promise. The mobile home shows "Advertise here", so it would
  have been false. The promises come from `app/press/page.tsx` instead.
- Two captures stacked for a scroll showed the second page's nav bar mid-page; its top 7% is
  cropped now.

## What worked

- Stills of every scene in both aspect ratios before the full render caught each layout bug.
- `pnpm build` asserts 60 fps, 1560 frames and the size with ffprobe, from the file.

## Rules

- Capture the app for marketing from the dev server, not production behind the WAF.
- A promise in marketing must be quoted from the app's own copy.
