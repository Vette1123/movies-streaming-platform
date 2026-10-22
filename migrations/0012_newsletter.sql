-- Newsletter subscribers for the "what's trending this week" digest.
-- Double opt-in is handled at the sender level; this table just stores the
-- sign-up email + source so the digest list can be exported to any mailer.
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'footer',
  subscribed_at INTEGER NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON newsletter_subscribers(email);
