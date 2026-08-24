# A mode needs a history entry, and a preference needs to arrive

Date: 2026-08-24
Area: `app/reels/page.tsx`, `lib/playback-prefs.ts`,
`components/account/playback-panel.tsx`, `cloudflare/worker.js`

## What

Two small things and one that had never worked.

**Full screen was a mode with no way out on a phone.** Reels' focus mode is
entered by a button and left by a button or Escape — both of which are things a
desktop has. The gesture a phone actually uses is back, and back left Reels
altogether: the trailer and the feed both gone from one swipe. Entering now
pushes a history entry, popstate leaves the mode, and leaving by the button
drops the entry so back never walks forward into full screen.

**The account's subtitle language had never once applied.** The player read it
from `localStorage['reely_playback_prefs']` — Reely's storage, on Reely's
origin, from inside a cross-origin iframe on the player's own origin. That read
returned null on every boot that has ever happened. The values were already
being put on the player URL by the ticket mint; the player just never looked at
them. It reads the query now.

**A setting for the full-screen progress bar**, because the thin line ArtPlayer
keeps lit once the controls hide is orientation in a window and a bright strip
across the picture for two hours on a phone. Off by default, in the player's own
settings panel (per device) and in the account panel (synced, carried on the
ticket as `mini`).

## Mistakes

**A cross-origin read that fails silently looks exactly like a preference
nobody set.** `localStorage.getItem` returns null for "different origin" and for
"never chose one" identically, and the code around it was correct in every other
respect — the wrong storage was the entire bug. The fix was already half-built:
the parameters were on the URL the whole time.

**"Escape leaves focus mode" was written and believed to be the way out.** It is
the way out on the machine the feature was built on. Reels is a phone surface
with a phone gesture, and the mode had no relationship with it at all.

**Three chip rows made it obvious the second one should have been extracted.**
Two identical twenty-line blocks read as fine until a third arrived.

## What worked

Driving the back gesture through CDP history navigation rather than trusting the
listener: enter, back, then assert _both_ that focus is off and that the page is
still `/reels` with its ten slides. A popstate handler that fires while the
router also unmounts the page would pass a listener-only check.

## Rules

- A mode entered on a touch device needs a history entry. The back gesture is
  the platform's universal "leave this", and without an entry it leaves the app.
- Push `{ ...history.state, marker: true }`, never a bare object: Next keeps its
  routing state in `history.state` and replacing it breaks its own back handling.
- A preference that crosses an origin travels in the URL or not at all.
