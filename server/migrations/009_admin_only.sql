-- Login is now restricted to a single admin account (checked in app code
-- against the ADMIN_EMAIL env var). Clean up test/throwaway accounts created
-- while building the TOTP flow and mark the real owner as admin.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

DELETE FROM users WHERE email != 'prof.thiagoaso@gmail.com';
UPDATE users SET is_admin = true WHERE email = 'prof.thiagoaso@gmail.com';
