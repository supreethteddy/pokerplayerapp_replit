-- Create credit_requests table in Staff Portal's Supabase
-- This table enables cross-portal credit management between Player Portal and Staff Portal

CREATE TABLE IF NOT EXISTS credit_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id INTEGER NOT NULL,
  requested_amount DECIMAL(10,2) NOT NULL,
  current_balance DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  request_note TEXT,
  admin_note TEXT,
  approved_by INTEGER,
  approved_at TIMESTAMP,
  rejected_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  universal_id VARCHAR(255)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_requests_player_id ON credit_requests(player_id);
CREATE INDEX IF NOT EXISTS idx_credit_requests_status ON credit_requests(status);
CREATE INDEX IF NOT EXISTS idx_credit_requests_created_at ON credit_requests(created_at);

-- Add credit_approved column to players table if not exists
ALTER TABLE players ADD COLUMN IF NOT EXISTS credit_approved BOOLEAN DEFAULT false;

-- Create sample approved player for testing
UPDATE players SET credit_approved = true WHERE id = 29;

-- Enable RLS (Row Level Security) for credit_requests table
ALTER TABLE credit_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own credit requests
CREATE POLICY IF NOT EXISTS "Users can view their own credit requests" ON credit_requests
  FOR SELECT
  TO authenticated
  USING (player_id = auth.uid()::integer);

-- Allow authenticated users to insert their own credit requests
CREATE POLICY IF NOT EXISTS "Users can insert their own credit requests" ON credit_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (player_id = auth.uid()::integer);

-- Allow service role to manage all credit requests (for Staff Portal)
CREATE POLICY IF NOT EXISTS "Service role can manage all credit requests" ON credit_requests
  FOR ALL
  TO service_role
  USING (true);

-- Grant permissions to service role
GRANT ALL ON credit_requests TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;