-- Migration: Add Razorpay fields to transactions table
-- This supports Razorpay payment integration

-- Add Razorpay-specific columns to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR(512);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_razorpay_order_id 
ON transactions(razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_transactions_razorpay_payment_id 
ON transactions(razorpay_payment_id);

-- Add unique constraint on razorpay_payment_id to prevent duplicate processing
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_razorpay_payment_id_unique 
ON transactions(razorpay_payment_id) 
WHERE razorpay_payment_id IS NOT NULL;

-- Verify changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transactions' 
  AND column_name LIKE 'razorpay%';
