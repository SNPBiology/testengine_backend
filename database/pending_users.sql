-- Create pending_users table for temporary OTP storage
CREATE TABLE IF NOT EXISTS pending_users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(15),
  password_hash TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  otp_expires_at TIMESTAMP NOT NULL,
  attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_users_email ON pending_users(email);
CREATE INDEX IF NOT EXISTS idx_pending_users_expires ON pending_users(otp_expires_at);

-- Add comment
COMMENT ON TABLE pending_users IS 'Temporary storage for users pending email verification via OTP';
