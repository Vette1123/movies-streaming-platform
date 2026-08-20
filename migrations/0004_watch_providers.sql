-- "Now streaming" alerts.
--
-- Both columns hang off the row the hourly sweep already writes, and both are
-- filled from a response it already fetches: the sweep's per-title TMDB call
-- gains `append_to_response=watch/providers`, which costs ZERO extra
-- subrequests. That matters more here than anywhere else in the codebase — the
-- 50-subrequests-per-invocation cap is what the whole sweep is shaped around.
--
-- `providers` is a JSON object keyed by the regions in config/regions.ts, each
-- value a sorted, pipe-joined list of the subscription services carrying the
-- title there: {"US":"Max|Netflix","GB":"Now"}. Pipe-joined rather than an
-- array because the string IS the comparison — a region has changed when its
-- string has changed, which is one `!==` rather than a set diff.
--
-- `providers_notified` is the same shape, holding what was last announced per
-- region. Separate from `notified_key` (which dedupes the release/episode
-- announcement) because the two fire on different events and a shared column
-- would mean one silencing the other.
ALTER TABLE watched_media ADD COLUMN providers TEXT;
ALTER TABLE watched_media ADD COLUMN providers_notified TEXT;
