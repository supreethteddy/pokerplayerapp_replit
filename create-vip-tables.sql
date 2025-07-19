-- VIP Points System Tables for Supabase
-- Run this script in Supabase SQL Editor

-- Create game sessions table for VIP tracking
CREATE TABLE IF NOT EXISTS game_sessions_vip (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  table_id TEXT NOT NULL,
  big_blind_amount DECIMAL(10,2) NOT NULL,
  rs_played DECIMAL(12,2) NOT NULL, -- Total rupees played/wagered in session
  session_start TIMESTAMPTZ DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  vip_points_earned DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create daily visits tracking
CREATE TABLE IF NOT EXISTS daily_visits (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  visit_date DATE NOT NULL,
  login_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, visit_date)
);

-- Create VIP points calculations table
CREATE TABLE IF NOT EXISTS vip_points_calculations (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  calculation_date DATE DEFAULT CURRENT_DATE,
  big_blind_points DECIMAL(10,2) DEFAULT 0,
  rs_played_points DECIMAL(10,2) DEFAULT 0,
  frequency_points DECIMAL(10,2) DEFAULT 0,
  total_vip_points DECIMAL(10,2) DEFAULT 0,
  month_year VARCHAR(7) NOT NULL, -- Format: YYYY-MM
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, month_year)
);

-- Create VIP redemption requests table
CREATE TABLE IF NOT EXISTS vip_redemption_requests (
  id SERIAL PRIMARY KEY,
  player_id INTEGER NOT NULL,
  redemption_type VARCHAR(100) NOT NULL,
  points_required INTEGER NOT NULL,
  points_redeemed INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  cashier_approved_by INTEGER,
  admin_approved_by INTEGER,
  cashier_approved_at TIMESTAMPTZ,
  admin_approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add VIP columns to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_rs_played DECIMAL(12,2) DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS current_vip_points DECIMAL(10,2) DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS lifetime_vip_points DECIMAL(10,2) DEFAULT 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_sessions_vip_player_id ON game_sessions_vip(player_id);
CREATE INDEX IF NOT EXISTS idx_daily_visits_player_date ON daily_visits(player_id, visit_date);
CREATE INDEX IF NOT EXISTS idx_vip_calculations_player_month ON vip_points_calculations(player_id, month_year);
CREATE INDEX IF NOT EXISTS idx_vip_redemptions_player_status ON vip_redemption_requests(player_id, status);

-- Insert test data for player 29 (vignesh)
INSERT INTO daily_visits (player_id, visit_date) VALUES 
(29, '2025-07-01'), (29, '2025-07-02'), (29, '2025-07-03'), (29, '2025-07-04'), (29, '2025-07-05'),
(29, '2025-07-06'), (29, '2025-07-07'), (29, '2025-07-08'), (29, '2025-07-09'), (29, '2025-07-10'),
(29, '2025-07-11'), (29, '2025-07-12'), (29, '2025-07-13'), (29, '2025-07-14'), (29, '2025-07-15'),
(29, '2025-07-16'), (29, '2025-07-17'), (29, '2025-07-18'), (29, '2025-07-19')
ON CONFLICT (player_id, visit_date) DO NOTHING;

-- Insert test game sessions
INSERT INTO game_sessions_vip (player_id, table_id, big_blind_amount, rs_played, session_start, session_end) VALUES
(29, 'table-001', 100.00, 5000.00, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour'),
(29, 'table-002', 200.00, 8000.00, NOW() - INTERVAL '1 day', NOW() - INTERVAL '23 hours'),
(29, 'table-001', 150.00, 12000.00, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '2 hours');

-- Update player 29's total Rs played
UPDATE players SET 
  total_rs_played = 25000.00,
  current_vip_points = 0.00,
  lifetime_vip_points = 0.00
WHERE id = 29;

-- Test VIP calculation for player 29
-- Formula: VIP Points = (Big Blind × 0.5) + (Rs Played × 0.3) + (Visit Frequency × 0.2)
-- Expected: (150 × 0.5) + (25000 × 0.3) + (19 × 0.2) = 75 + 7500 + 3.8 = 7578.8 points