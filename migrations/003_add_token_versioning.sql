-- Migration: Add token versioning for JWT invalidation
-- This allows invalidating all user tokens on security events (password change, etc.)

-- Add token_version column to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS token_version INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN users.token_version IS 'Incremented on password change to invalidate all existing tokens';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_token_version ON users(user_id, token_version);
