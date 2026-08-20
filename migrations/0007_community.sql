-- The public directory at /lists reads two things nothing else reads in bulk:
-- every published list, newest first, and every public profile. Both are
-- filtered scans today because nothing has ever needed them in that shape.
--
-- Partial indexes rather than full ones: an unpublished list and a private
-- account are the common case and have no business in either index.
CREATE INDEX IF NOT EXISTS idx_lists_published
  ON lists (published, updated_at DESC) WHERE published = 1;

CREATE INDEX IF NOT EXISTS idx_users_public_profile
  ON users (profile_public, created_at) WHERE profile_public = 1;
