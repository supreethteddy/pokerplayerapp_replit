
-- Fix seat_requests table schema to match codebase expectations
-- Run this in your Supabase SQL editor

-- First, add missing columns
ALTER TABLE seat_requests 
ADD COLUMN IF NOT EXISTS seat_number integer,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS universal_id text UNIQUE,
ADD COLUMN IF NOT EXISTS session_start_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS min_play_time_minutes integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS call_time_window_minutes integer DEFAULT 10,
ADD COLUMN IF NOT EXISTS call_time_play_period_minutes integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS cashout_window_minutes integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS call_time_started timestamp with time zone,
ADD COLUMN IF NOT EXISTS call_time_ends timestamp with time zone,
ADD COLUMN IF NOT EXISTS cashout_window_active boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cashout_window_ends timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_cashout_attempt timestamp with time zone,
ADD COLUMN IF NOT EXISTS session_buy_in_amount decimal(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS session_cash_out_amount decimal(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS session_rake_amount decimal(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS session_tip_amount decimal(10,2) DEFAULT 0.00;

-- Change table_id from integer to text to support UUIDs
ALTER TABLE seat_requests 
DROP CONSTRAINT IF EXISTS seat_requests_table_id_fkey;

ALTER TABLE seat_requests 
ALTER COLUMN table_id TYPE text USING table_id::text;

-- Add back foreign key constraint if tables exist with text/UUID ids
-- ALTER TABLE seat_requests 
-- ADD CONSTRAINT seat_requests_table_id_fkey 
-- FOREIGN KEY (table_id) REFERENCES poker_tables(id) ON DELETE CASCADE;

-- Create or replace the update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Recreate the trigger
DROP TRIGGER IF EXISTS update_seat_requests_updated_at ON seat_requests;
CREATE TRIGGER update_seat_requests_updated_at 
    BEFORE UPDATE ON seat_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_seat_requests_player_id ON seat_requests(player_id);
CREATE INDEX IF NOT EXISTS idx_seat_requests_table_id ON seat_requests(table_id);
CREATE INDEX IF NOT EXISTS idx_seat_requests_status ON seat_requests(status);
CREATE INDEX IF NOT EXISTS idx_seat_requests_universal_id ON seat_requests(universal_id);
