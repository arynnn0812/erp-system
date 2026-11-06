-- 002: revocable sessions.
-- Every JWT carries the token_version it was issued under; the auth middleware
-- rejects it once the stored value moves on. Bumping the column logs a user out
-- everywhere: on "log out all devices", password change, deactivation.
ALTER TABLE users
  ADD COLUMN token_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER is_active;
