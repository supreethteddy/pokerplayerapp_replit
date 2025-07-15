-- FIX EXISTING SUPABASE SETUP - WORKS WITH CURRENT STRUCTURE
-- This fixes the existing table structure and adds missing columns

-- Step 1: Add missing columns to existing players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'pending';
ALTER TABLE players ADD COLUMN IF NOT EXISTS balance TEXT DEFAULT '0.00';
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_deposits TEXT DEFAULT '0.00';
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_withdrawals TEXT DEFAULT '0.00';
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_winnings TEXT DEFAULT '0.00';
ALTER TABLE players ADD COLUMN IF NOT EXISTS total_losses TEXT DEFAULT '0.00';
ALTER TABLE players ADD COLUMN IF NOT EXISTS games_played INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN IF NOT EXISTS hours_played TEXT DEFAULT '0.00';

-- Step 2: Update existing players table to ensure NOT NULL constraints
UPDATE players SET password = 'password123' WHERE password IS NULL;
UPDATE players SET first_name = 'Unknown' WHERE first_name IS NULL;
UPDATE players SET last_name = 'Player' WHERE last_name IS NULL;
UPDATE players SET phone = '0000000000' WHERE phone IS NULL;
UPDATE players SET kyc_status = 'pending' WHERE kyc_status IS NULL;
UPDATE players SET balance = '0.00' WHERE balance IS NULL;
UPDATE players SET total_deposits = '0.00' WHERE total_deposits IS NULL;
UPDATE players SET total_withdrawals = '0.00' WHERE total_withdrawals IS NULL;
UPDATE players SET total_winnings = '0.00' WHERE total_winnings IS NULL;
UPDATE players SET total_losses = '0.00' WHERE total_losses IS NULL;
UPDATE players SET games_played = 0 WHERE games_played IS NULL;
UPDATE players SET hours_played = '0.00' WHERE hours_played IS NULL;

-- Step 3: Add NOT NULL constraints
ALTER TABLE players ALTER COLUMN password SET NOT NULL;
ALTER TABLE players ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE players ALTER COLUMN last_name SET NOT NULL;
ALTER TABLE players ALTER COLUMN phone SET NOT NULL;
ALTER TABLE players ALTER COLUMN kyc_status SET NOT NULL;
ALTER TABLE players ALTER COLUMN balance SET NOT NULL;
ALTER TABLE players ALTER COLUMN total_deposits SET NOT NULL;
ALTER TABLE players ALTER COLUMN total_withdrawals SET NOT NULL;
ALTER TABLE players ALTER COLUMN total_winnings SET NOT NULL;
ALTER TABLE players ALTER COLUMN total_losses SET NOT NULL;
ALTER TABLE players ALTER COLUMN games_played SET NOT NULL;
ALTER TABLE players ALTER COLUMN hours_played SET NOT NULL;

-- Step 4: Create player_prefs table if it doesn't exist
CREATE TABLE IF NOT EXISTS player_prefs (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    seat_available BOOLEAN DEFAULT TRUE,
    call_time_warning BOOLEAN DEFAULT TRUE,
    game_updates BOOLEAN DEFAULT FALSE
);

-- Step 5: Create tables table if it doesn't exist (rename to avoid conflict)
CREATE TABLE IF NOT EXISTS tables (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    game_type TEXT NOT NULL,
    stakes TEXT NOT NULL,
    max_players INTEGER NOT NULL,
    current_players INTEGER DEFAULT 0,
    pot INTEGER DEFAULT 0,
    avg_stack INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- Step 6: Create kyc_documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS kyc_documents (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 7: Insert the 9 players from Neon database
INSERT INTO players (email, password, first_name, last_name, phone, kyc_status, balance, total_deposits, total_withdrawals, total_winnings, total_losses, games_played, hours_played) VALUES
('test@supabase.com', 'password123', 'Test', 'Player', '1234567890', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('new@supabase.com', 'password123', 'New', 'Player', '9876543210', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('supabase.direct@test.com', 'password123', 'Supabase', 'Direct', '1234567890', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('final.test@supabase.com', 'password123', 'Final', 'Test', '9876543210', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('manual.test@supabase.com', 'password123', 'Manual', 'Test', '9999999999', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('now.supabase@test.com', 'password123', 'Now', 'Supabase', '1111111111', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('test.user1@supabase.com', 'password123', 'Test', 'User1', '5555555555', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('test.user2@supabase.com', 'password123', 'Test', 'User2', '6666666666', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('test.user3@supabase.com', 'password123', 'Test', 'User3', '7777777777', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00')
ON CONFLICT (email) DO UPDATE SET
    password = EXCLUDED.password,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    kyc_status = EXCLUDED.kyc_status,
    balance = EXCLUDED.balance,
    total_deposits = EXCLUDED.total_deposits,
    total_withdrawals = EXCLUDED.total_withdrawals,
    total_winnings = EXCLUDED.total_winnings,
    total_losses = EXCLUDED.total_losses,
    games_played = EXCLUDED.games_played,
    hours_played = EXCLUDED.hours_played;

-- Step 8: Insert poker tables for staff portal
INSERT INTO tables (name, game_type, stakes, max_players, current_players, pot, avg_stack, is_active) VALUES
('High Stakes Hold''em', 'Texas Hold''em', '₹500/₹1000', 9, 3, 15000, 125000, true),
('Mid Stakes Omaha', 'Pot Limit Omaha', '₹100/₹200', 6, 2, 5000, 45000, true),
('Low Stakes Hold''em', 'Texas Hold''em', '₹25/₹50', 9, 5, 1200, 8500, true),
('Tournament Table', 'Texas Hold''em', '₹1000 Buy-in', 8, 1, 25000, 50000, true),
('Cash Game Express', 'Texas Hold''em', '₹50/₹100', 6, 4, 2500, 12000, true)
ON CONFLICT DO NOTHING;

-- Step 9: Create default preferences for all players
INSERT INTO player_prefs (player_id, seat_available, call_time_warning, game_updates)
SELECT id, TRUE, TRUE, FALSE FROM players
WHERE id NOT IN (SELECT player_id FROM player_prefs WHERE player_id IS NOT NULL)
ON CONFLICT DO NOTHING;

-- Step 10: Insert sample seat requests for waitlist functionality
INSERT INTO seat_requests (player_id, table_id, status, position, estimated_wait) VALUES
(1, 1, 'waiting', 1, 5),
(2, 1, 'waiting', 2, 10),
(3, 2, 'waiting', 1, 3),
(4, 3, 'waiting', 1, 2),
(5, 4, 'waiting', 1, 15)
ON CONFLICT DO NOTHING;

-- Step 11: Insert sample KYC documents
INSERT INTO kyc_documents (player_id, document_type, file_name, file_url, status) VALUES
(1, 'passport', 'passport_test_player.jpg', '/uploads/kyc/passport_test_player.jpg', 'pending'),
(2, 'driving_license', 'dl_new_player.jpg', '/uploads/kyc/dl_new_player.jpg', 'pending'),
(3, 'aadhar', 'aadhar_supabase_direct.jpg', '/uploads/kyc/aadhar_supabase_direct.jpg', 'approved')
ON CONFLICT DO NOTHING;

-- Step 12: Insert sample transactions
INSERT INTO transactions (player_id, type, amount, description, staff_id) VALUES
(1, 'deposit', '10000.00', 'Initial deposit via UPI', 'staff_001'),
(2, 'deposit', '5000.00', 'Bank transfer deposit', 'staff_002'),
(3, 'win', '2500.00', 'Tournament winnings', NULL),
(4, 'deposit', '15000.00', 'Credit card deposit', 'staff_001')
ON CONFLICT DO NOTHING;

-- Step 13: Verification
SELECT 'SUPABASE SETUP COMPLETE - ALL PORTALS INTEGRATED' as status;
SELECT 'Players in database:' as info, COUNT(*) as count FROM players;
SELECT 'Tables available:' as info, COUNT(*) as count FROM tables;
SELECT 'Seat requests:' as info, COUNT(*) as count FROM seat_requests;
SELECT 'KYC documents:' as info, COUNT(*) as count FROM kyc_documents;
SELECT 'Player preferences:' as info, COUNT(*) as count FROM player_prefs;

-- Step 14: Show players for verification
SELECT id, email, first_name, last_name, kyc_status, balance FROM players ORDER BY id;