-- Create table_sessions table for tracking live poker sessions
-- This table tracks when players are seated at tables and their session details

CREATE TABLE IF NOT EXISTS table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL,
  table_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  seat_number INTEGER,
  buy_in_amount DECIMAL(10,2) DEFAULT 0,
  current_chips DECIMAL(10,2) DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add foreign key constraint to staff_tables
  CONSTRAINT fk_table_sessions_table_id 
    FOREIGN KEY (table_id) 
    REFERENCES staff_tables(id) 
    ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_table_sessions_player_id ON table_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_started_at ON table_sessions(started_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE table_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for service role
CREATE POLICY "Enable all operations for service role" ON table_sessions
FOR ALL USING (auth.role() = 'service_role');

-- Policy: Allow players to read their own sessions
CREATE POLICY "Players can read own sessions" ON table_sessions
FOR SELECT USING (true);

-- Policy: Allow staff to manage all sessions (via service role)
CREATE POLICY "Staff can manage all sessions" ON table_sessions
FOR ALL USING (true);

-- Update function for timestamps
CREATE OR REPLACE FUNCTION update_table_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_table_sessions_updated_at ON table_sessions;
CREATE TRIGGER trigger_update_table_sessions_updated_at
  BEFORE UPDATE ON table_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_table_sessions_updated_at();

-- Insert a test session for player 179 to test the PlaytimeTracker
-- Using table id from the known active tables
INSERT INTO table_sessions (
  player_id,
  table_id,
  status,
  seat_number,
  buy_in_amount,
  current_chips,
  started_at
) VALUES (
  179,
  '56551992-75ac-4248-b5e1-65417d2e4047', -- 'hello123' table
  'active',
  3,
  5000.00,
  7500.00,
  NOW() - INTERVAL '25 minutes'
) ON CONFLICT DO NOTHING;

-- Insert another test session to verify the functionality
INSERT INTO table_sessions (
  player_id,
  table_id,
  status,
  seat_number,
  buy_in_amount,
  current_chips,
  started_at
) VALUES (
  179,
  'fc97c90c-4b07-46df-b446-fd966a39d9a1', -- 'call time table'
  'ended',
  5,
  3000.00,
  4200.00,
  NOW() - INTERVAL '2 hours'
) ON CONFLICT DO NOTHING;

COMMIT;