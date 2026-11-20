# Promo films

Two cuts of one 26-second film about Reely, rendered with [Remotion](https://www.remotion.dev)
at 60 fps:

| Cut    | Size            | File                         |
| ------ | --------------- | ---------------------------- |
| `Film` | 1920×1080, 16:9 | `out/reely-film-1080p60.mp4` |
| `Reel` | 1080×1920, 9:16 | `out/reely-reel-9x16-60.mp4` |

The published copies live in `docs/films/`. This folder is its own package with its own
dependencies: the app never installs or bundles any of it.

## Make it

```bash
cd video
pnpm install --ignore-workspace
pnpm dev                                    # in the repo root, for the capture below
SITE=http://localhost:3000 pnpm capture     # real screens -> public/shots/
pnpm beat                                   # the soundtrack -> public/audio/beat-reely.wav
pnpm studio                                 # scrub and edit in the browser
pnpm build                                  # render both cuts, assert fps, frames, size
```

`pnpm build Reel` renders one cut. Copy a finished cut to `docs/films/` to publish it.

## How it is put together

- **The cut follows the soundtrack.** 120 BPM at 60 fps is 30 frames a beat, and every
  scene starts on a beat (`src/timing.ts`): the drop on beat 6, the three promises on beats
  36, 38 and 40, the outro on 42.
- **The screens are the app.** `tools/capture.mjs` drives headless Chrome over the DevTools
  protocol. Production's bot challenge stops headless Chrome on title pages, so captures run
  against `pnpm dev`. Before any page script it turns hero trailers off and dismisses the
  install prompt, so neither lands in a shot.
- **Poster art outside the captures is drawn**, as on the share card: gradients, never
  real artwork.
- **Every claim is the app's own** (`app/press/page.tsx`): four rating sources, free, open
  source, no account needed to browse, rate or track.
- **Grain and drifting glows are there for the encoder.** A still, dark gradient bands as
  soon as H.264 quantises it.
