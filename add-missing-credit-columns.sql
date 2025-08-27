
-- Add missing credit system columns to players table in Supabase
-- This fixes the "column does not exist" error for credit_eligible, current_credit, credit_limit

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS current_credit DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS credit_eligible BOOLEAN DEFAULT false;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_credit_eligible ON players(credit_eligible);
CREATE INDEX IF NOT EXISTS idx_players_current_credit ON players(current_credit);

-- Update existing records with default values
UPDATE players 
SET 
  current_credit = COALESCE(current_credit, 0.00),
  credit_limit = COALESCE(credit_limit, 0.00),
  credit_eligible = COALESCE(credit_eligible, false)
WHERE current_credit IS NULL OR credit_limit IS NULL OR credit_eligible IS NULL;

-- Verify the changes
SELECT id, email, balance, current_credit, credit_limit, credit_eligible 
FROM players 
LIMIT 5;

-- Add comments for documentation
COMMENT ON COLUMN players.current_credit IS 'Current credit balance for player';
COMMENT ON COLUMN players.credit_limit IS 'Maximum credit limit approved for player';
COMMENT ON COLUMN players.credit_eligible IS 'Whether player is approved for credit system';
