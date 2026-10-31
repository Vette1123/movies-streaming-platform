# Reely on Kodi

A supporter feature: browse Reely and play through the Reely Player on a TV.

## What it runs on

- **Kodi 19 or newer**, any platform. Kodi 18 and older are Python 2 and refuse the
  add-on; supporting them would need a second package.
- **Fire TV on Fire OS only.** Vega OS devices (Fire TV Stick 4K Select, new
  Fire TV Sticks) cannot install Kodi at all, so no add-on can reach them.

## Install, for a supporter

1. In Kodi: Settings > System > Add-ons, turn on **Unknown sources**.
2. Download the zip to the device (on a Fire TV, with the Downloader app):

```
https://www.reely.space/kodi/plugin.video.reely.zip
```

3. In Kodi: Add-ons > Install from zip file, and pick it.
4. Open Reely, choose **Link this TV**, and enter the code at:

```
reely.space/link
```

## How it fits together

- `/kodi` is the install guide, linked from the footer, `/support`, the supporter
  panel, the account page and `/link`. It stays noindex. `tests/support-features.test.ts`
  fails if a link to it goes missing.
- `kodi/plugin.video.reely/` is the add-on: `plugin.py` is the Kodi half,
  `reely_api.py` the HTTP half with no Kodi imports. Standard library only.
- `lib/auth/device.ts` is device sign-in. The token is an ordinary `sessions` row
  sent as a bearer, so 90-day expiry, the five-session cap and "sign out
  everywhere" all apply. After 90 days the TV asks to be linked again.
- `/api/pro/ticket` requires a supporter for every bearer, so a lapsed supporter's
  TV stops. The free web title never applies to a TV (`lib/pro/ticket-access.ts`).
- `pnpm kodi:probe` walks all of it against production with throwaway accounts.
- `pnpm kodi:zip` builds the zip from what is COMMITTED; `build:cf` runs it. Bump
  `version` in `addon.xml` and `VERSION` in `reely_api.py` together.

## Not in this version

No auto-update (a Kodi repository would give that), no subtitles, no resume sync,
no watchlist. Kodi resumes locally on its own.
