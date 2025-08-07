-- Add missing credit system columns to Supabase production database
-- This fixes the balance system by adding credit management fields

-- Add credit system columns to players table
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS current_credit DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS credit_approved BOOLEAN DEFAULT false;

-- Update existing Player ID 29 with proper credit defaults
UPDATE players 
SET 
  current_credit = 0.00,
  credit_limit = 0.00,
  credit_approved = false
WHERE id = 29;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_credit_approved ON players(credit_approved);
CREATE INDEX IF NOT EXISTS idx_players_current_credit ON players(current_credit);

-- Verify the changes
SELECT id, email, balance, current_credit, credit_limit, credit_approved 
FROM players 
WHERE id = 29;

COMMENT ON COLUMN players.current_credit IS 'Current credit balance for player';
COMMENT ON COLUMN players.credit_limit IS 'Maximum credit limit approved for player';
COMMENT ON COLUMN players.credit_approved IS 'Whether player is approved for credit system';