# Filling slots 3 and 5: screened candidates, set the secrets, verified live

Date: 2026-08-23

## What

Slots 3 and 5 were wired end to end (workflow forwarding done earlier today) but
empty. Screened ten public embed-provider candidates over HTTP and set GitHub
secrets for the two survivors of different families:

- Slot 3 = vidlink.pro — default vidsrc path shape (`/movie/{id}`,
  `/tv/{id}/{s}/{e}`), passed movie+TV probes, and it is the one provider that
  publishes progress events (PLAYER_EVENT/MEDIA_DATA), so
  `components/player/embed-progress-bridge.tsx` activates for it with no new
  code.
- Slot 5 = vidfast.pro — passed both shapes; different family again.

Labels left unset on purpose: the UI's "Server N" convention exists so the site
never names a host.

## Mistakes

- **Almost re-architected slot 1 from a stale lesson instead of the live state.**
  This morning's vidlink lesson says "Server 1 = vidlink.pro (branded)", but the
  working tree's `.env.local` had since been reverted to vidsrcme.ru and prod
  serves vsembed.ru there. The lesson recorded an INTENT whose precondition
  (a branding palette decision) no longer held. The lesson is a map, not orders —
  when it disagrees with current config, the config wins until the human says
  otherwise. Slots 3/5 got filled; slot 1 was not touched.
- **The first screener pass trusted single-shape results too much**: multiembed.mov
  "passed" movies but its TV page carried no player markers at all — a wrapper,
  not a player. Both shapes must pass or the candidate is out; half a provider is
  a black rectangle with extra steps.

## What worked

- Screening over HTTP before anything else: ten candidates → two alive in one run
  (~30s). Dead hosts fail with connection errors, challenge pages fail on body
  markers, and wrong path shapes fail as tiny/blank pages. Playback still deserves
  one visual `pnpm embed:probe` check, but this killed nine candidates for free.
- `gh secret set NAME --body value` straight from the shell made secrets a
  one-command step, then `gh secret list` proved them — the same split that
  diagnosed the morning bug ("is it there?" vs "does it reach the build?").
- Mirroring the values into `.env.local` immediately so local dev and prod agree;
  the drift between local vidsrcme.ru and prod vsembed.ru is exactly how confusion
  starts.

## Rules

- Fill a slot only with a candidate that passes BOTH movie and TV probes; a
  provider that only plays movies is a dead fallback for half the catalog.
- A lesson's plan needs its preconditions re-checked against current config
  before being executed by anyone else — including by an agent later.
- Prefer providers publishing progress events for any NEW slot; the bridge costs
  nothing when absent and makes resume work when present.
