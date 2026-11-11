// When eyeball 5xx is an outage, and when it is one stray response.
//
// The gate used to fail on any 5xx at all. On 2026-11-11 it went red on 1×503
// of 179,363 requests (0.0006%): no outage, nothing to fix. A gate that is red
// on noise gets skipped, and then it is skipped on the day it is real.
//
// So any 5xx still shows (warn), and it fails only when BOTH hold:
//   - the rate is at least 0.05%: at ~125 requests a minute that is under a
//     minute of hard failure in a day, so a real outage clears it fast; and
//   - there are at least 10 failures, so one blip in a short low-traffic
//     window (`pnpm cf:health 1` at night) does not read as a 0.2% outage.

const FAIL_RATE = 0.0005
const FAIL_MIN_COUNT = 10

/** true (pass), 'warn' or false (fail) — the shape `grade()` takes. */
export const eyeball5xxGrade = (failures, total) => {
  if (failures === 0) return true
  const rate = total ? failures / total : 1
  if (rate >= FAIL_RATE && failures >= FAIL_MIN_COUNT) return false
  return 'warn'
}
