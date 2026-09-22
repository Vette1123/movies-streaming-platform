-- Phone-as-remote transport: the Worker stores a one-shot command alongside the
-- host's beat, and the host loop drains it into the existing postMessage path.
ALTER TABLE together_beats ADD COLUMN cmd_position REAL;
ALTER TABLE together_beats ADD COLUMN cmd_playing INTEGER;
ALTER TABLE together_beats ADD COLUMN cmd_at INTEGER;
