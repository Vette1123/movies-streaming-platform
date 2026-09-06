# 2026-09-06 — The chips were wider than the film, and the progress never arrived

## What

The player bar hung off the video on both sides and sat on the picture, and
the house player was the only source on the site where nothing about playback
was recorded. Two unrelated reports; the same afternoon's work.

### The bar

`top-20` on the control overlay and `py-20` on the frame are the same offset.
The overlay was also laid out on the hero's **container**, which is wider than
the frame. Measured on a 1440px hero, playing:

|             | left | right | top |
| ----------- | ---- | ----- | --- |
| control bar | 556  | 1996  | 75  |
| picture     | 586  | 1966  | 75  |

So the chips started at the video's first pixel and overhung it by 30px on each
side. A comment above the overlay claimed the band above the frame was empty on
every viewport. It was never empty, because nothing reserved it. And the row
was `flex-wrap`, so six servers on a phone were four rows of pills laid over the
film, with the row height changing under the visitor every time the stall
notice swapped in.

`components/player/player-stage.tsx` replaces the arithmetic with a column: bar,
then picture, sharing one width. Overhang stops being expressible rather than
being corrected. Both surfaces mount through it, so the inset, the spinner and
the stacking context are written once — they had been duplicated, and had
already drifted (only one branch centred its spinner on the frame).

The servers are now a rail that scrolls and never wraps: one row at every
width, centred until it cannot be, with the fade and the left-alignment driven
by a real `scrollWidth > clientWidth` measurement rather than a guess. Settings
moved inside the bar, because a second filled pill beside six server pills read
as a seventh server.

### The progress

`parseEmbedProgress` recognised `{type:'PLAYER_EVENT', data:{…}}`. That shape
is real and it never crosses an origin boundary. The provider's inner player
posts it to the page that frames it; that page is theirs, and what it re-posts
to us is the same payload moved under `event`. From their own bundle:

```js
window.parent.postMessage({ type: 'PLAYER_EVENT', event: r.data }, '*')
```

The recogniser had been tested against the one shape a reely.space listener can
never receive. Continue-watching has been blind to embed playback since it
shipped. Both depths are accepted now, and `complete` alongside `ended`.

The house player lost it twice over: its events stopped one document short, at
the playback worker. That half is fixed in `reely-pro-player` — see
[the grant stopped one frame short](https://github.com/Vette1123/reely-pro-player)
— along with the reason the Reely slot would not play at all: it framed the
provider with `allowFullscreen` and no `allow`, so autoplay and
`encrypted-media` were denied two levels down while every plain "Server N" slot
had them.

Two smaller gaps found while verifying: `PlayerSettings` gated on
`useAccount().pro`, which is false until the session refresh lands and stays
false when it cannot land at all, so a supporter could be watching the house
player with no way to reach its subtitles; and the switcher's nine-second stall
detector can never fire on the house player, because our shell paints in 200ms
and `load` marks the source healthy before the picture would have arrived. The
worker now relays the provider's error event as `unavailable`, which is the
only signal that can start that timer.

## Mistakes

- **Believed the comment instead of the box model.** "The band above the frame
  is empty on every viewport" was written next to the code that filled it. Two
  `getBoundingClientRect` calls disproved it, and they were available before any
  of the reasoning was.
- **Called the Reely player broken from a screenshot.** The automation browser's
  tab is permanently `visibilityState: hidden` and rendering is throttled to
  about 1 Hz, so a buffering HLS player and a dead one look the same. The
  provider's own page spun identically, and then played, reporting
  `duration: 8348.33` — the correct runtime. In that harness, judge playback by
  the postMessage stream and the network table, never by the picture.
- **Went shopping for a new provider before diffing against a working one.**
  Server 2 plays and Reely Beta does not, and the structural difference is one
  level of nesting. That comparison was the first thing the house style asks
  for and it came after four provider walks.
- **Nearly shipped `?startAt=` for resume.** Their API forwards unknown query
  parameters into the embed URL, which looks like support. Grepping the embed's
  own 147 KB bundle returns zero hits for `startAt`, `autoPlay` and
  `primaryColor`. A parameter that survives a hop is not a parameter that is
  read.

## What worked

- **Reading the provider's own page chunk.** Same-origin on their site, and the
  route chunk is 1.8 KB. It names the envelope, the re-wrap, and the
  `useSearchParams` passthrough. Every question about their contract was
  answerable from their source rather than from a trace.
- **Listening for `message` from a foreign origin before touching the parser.**
  Framing the provider from `localhost:3000` and again from `reely.space` and
  logging what arrived proved the key moves, with no code changed.
- **The cors/no-cors pair.** `mode:'cors'` throws on the provider's mint hops
  while `mode:'no-cors'` resolves opaque in 140ms — the network reaches the
  host, and CORS is what refuses. One test, two hypotheses killed. Yesterday's
  egress result re-confirmed in 30 seconds through the relay's own probe:
  `/api/movie/550` and `/embed/<id>` still 403, `/api/list/movie` still 200.
  The box is still closed, so the house player's value has to come from what we
  own, which is exactly what the progress relay restores.
- **Seeding `reely_account=1` plus `reely_profile` to test a supporter locally.**
  The hint cookie is what stops the store from settling signed-out and wiping
  the cache; without it the profile is cleared on the first paint and the whole
  supporter surface is untestable on `localhost`.

## Rules

- **Never position an overlay against a number that another rule also owns.**
  `top-20` matching `py-20` is not a coincidence to notice later, it is a bug
  waiting for one of them to change. Put both in one box and let layout do it.
- **An overlay must share a box with the thing it overlays, not with its
  container.** Otherwise its width is somebody else's width.
- **A postMessage contract is a shape, not a key path.** The same payload lands
  under a different key at every level a provider's own frames re-post it.
  Accept every depth you can be mounted at, and test against the depth that
  actually reaches you.
- **Entitlement reads come from the cached identity, never the raw store.**
  `useAccount().pro` is unanswered on a cold page and permanently false when the
  refresh cannot land. Three components have now had this bug.
- **Grep the player bundle before believing a query parameter.**
- **Never call playback broken from the automation browser.** Judge by events
  and requests; let a person judge the picture.
