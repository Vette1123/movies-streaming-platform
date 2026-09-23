-- The phone remote's capability. The room code is shared with every guest, so
-- it cannot also be what lets a device steer the HOST's player: this key is
-- minted with the room, handed only to the host, and travels only in the QR.
-- Rooms created before this column exist with NULL and simply have no remote.
ALTER TABLE together_beats ADD COLUMN remote_key TEXT;
