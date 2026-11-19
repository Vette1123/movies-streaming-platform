# Three usage-report alarms, none a code bug

## What

`pnpm posthog:usage` flagged three things on 17 Nov. Each was checked against
raw events before anything was changed.

| Alarm                                              | What the events say                                                                                                                                                                                                                          | Action                                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| vidlink.pro failed 14 times against 10 plays (58%) | 14 failures from 5 people; 12 are stalls from 3 people. vidsrc.sh carries 358 plays at 14%.                                                                                                                                                  | None. Three people's stalls are not a reason to reorder servers (the order lives in deploy env, not code). |
| "playback" reach fell from 47% to 30%              | People with `media_played`: 197 (3-9 Nov) vs 120 (10-17 Nov). Play rate per detail-page viewer dipped 11-14 Nov (26-40%) and is back to 45-52% on 15-17 Nov (43-63% before). The fall is fewer detail-page viewers (about 65/day to 43/day). | None in code.                                                                                              |
| Fewer detail-page viewers                          | Bing referrals fell from 81 to 34 people, and 29 of the lost ones were one show, `/tv-shows/330613` (40 to 11). It is not one of the five titles taken down on 10 Nov.                                                                       | None. Search interest in one show faded.                                                                   |

Home mobile Lighthouse, measured live 3 times: 80 / 65 / 72 (median 72),
LCP 4.4-4.7 s simulated against about 1.1 s observed. The LCP image is a 12 KB
WebP with fetchpriority=high, done at about 530 ms. The simulated cost is
about 410 KB of script, mostly React DOM and framer-motion. No single change
would move it; the only real lever is taking the first-paint hero off
framer-motion, which needs a local before/after first.

## Mistakes

- Read "playback reach fell 47% to 30%" as a broken play path. The Watch Now
  deferral (`ad9e259`) shipped the same day and looked guilty. The per-day play
  rate per detail-page viewer cleared it: the rate recovered, the traffic did not.

## What worked

- Dividing plays by detail-page viewers per day separates "the player broke"
  from "fewer people arrived".
- Grouping lost referrals by landing path: one show explained most of the drop.

## Rules

- A reach alarm is checked as a rate per day against its own denominator
  before anyone suspects the deploy that shipped that week.
- A server failure rate is read with its people count; under 5 people it is
  not a reason to reorder servers.
