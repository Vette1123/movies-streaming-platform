# The quota ran out before hydration

## What

"The site loads so slow, I see alt text, then it loads." ImageKit had spent its
free bandwidth and answered every image with `429 Bandwidth Limit Exceeded`.
Lighthouse on production: LCP 6.7s, the hero 0 KB and failed, then 2.7s of load
delay behind the scripts. A prerendered page cannot run `onError` until React
hydrates, so the fallback chain that "can never break an image" did nothing on
the first screen, and next/image drops its `color: transparent` on error, which
is what put the alt text on screen.

ImageKit is gone from the app. wsrv.nl is the primary, TMDB's origin the last
resort, and there is no account, key or env var left. Also fixed:

- `img { color: transparent }`, so alt text can never paint.
- The image `preconnect` carried `crossOrigin`, which opens a socket a no-cors
  `<img>` never uses. It had been wasted for as long as it existed.
- The hero preload only existed for AVIF. It now names the WebP srcset, built by
  the same loader the `<img>` uses.
- Share cards: the Worker's `/api/og/card` returns an SVG, wsrv rasterises it.

Follow-up on first load: parked hero slides render no art until the page has
loaded (they sat inside the lazy-load margin and took 281 of 776 KB), every wsrv
URL carries `&default=1`, and the homepage hero paints a ~300-byte blur at once.

## Mistakes

- First timing run cut URLs at the commas inside ImageKit's transforms and got a
  7-byte error, which I nearly filed as bad data. The second run printed status
  and body, and the body was the whole diagnosis. Read the response, not the
  timing.
- Planned to keep ImageKit dormant behind the builders, "in case". The user said
  remove it, and the dormant code would have been AVIF paths nothing could reach.
- Told the user the mosaic had to die because wsrv cannot draw text overlays.
  wsrv rasterises SVG, which draws text. Thirty minutes of probing replaced a
  regression with the same feature and no quota.
- Read Lighthouse's 8.2s simulated LCP against the old 6.7s as a regression. The
  measured subparts went from 7.1s to 3.9s; the estimate rose because images now
  download instead of failing at 0 KB. Compare subparts, not the headline.
- Blamed wsrv for a 502 that came from a bad echo host and unpadded base64. Check
  the suspect with a known-good input first.

## What worked

- `curl -D -` against the image host before reading any render code. The bug
  looked like a loading problem and was an account limit.
- Measuring wsrv's unused options instead of adopting them: `sharp` is +55%, JPEG
  XL loses on typical art, AVIF is a 400.
- Probing text, embedded and remote images separately. Remote `<image href>`
  draws nothing, which decided the design.

## Rules

- `loading="lazy"` does not hold back anything within roughly a viewport of the
  screen. To keep a mounted neighbour off the network, do not render the <img>.
- A prerendered page's primary image host must have no monthly cap. `onError`
  runs after hydration, so it is not a safety net for the first screen.
- A fallback is only tested when its failure mode is. This one was tested with
  images failing after load, never with every image failing before it.
- `image_host_fallback` jumped from 3 a day to 58 and nothing alarmed. A silent
  chain needs a spike alert on that event.
