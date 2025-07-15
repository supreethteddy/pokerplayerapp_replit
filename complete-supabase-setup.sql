-- COMPLETE SUPABASE SETUP - FULL INTEGRATION WITH STAFF PORTALS
-- This maintains all functionality for player portal, staff poker portal, and master admin portal

-- Step 1: Clean up any existing tables
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS kyc_documents CASCADE;
DROP TABLE IF EXISTS seat_requests CASCADE;
DROP TABLE IF EXISTS player_prefs CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS tables CASCADE;

-- Step 2: Create players table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    kyc_status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    balance TEXT NOT NULL DEFAULT '0.00',
    total_deposits TEXT NOT NULL DEFAULT '0.00',
    total_withdrawals TEXT NOT NULL DEFAULT '0.00',
    total_winnings TEXT NOT NULL DEFAULT '0.00',
    total_losses TEXT NOT NULL DEFAULT '0.00',
    games_played INTEGER NOT NULL DEFAULT 0,
    hours_played TEXT NOT NULL DEFAULT '0.00'
);

-- Step 3: Create player preferences table
CREATE TABLE player_prefs (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    seat_available BOOLEAN DEFAULT TRUE,
    call_time_warning BOOLEAN DEFAULT TRUE,
    game_updates BOOLEAN DEFAULT FALSE
);

-- Step 4: Create tables for poker rooms (CRITICAL for staff portal integration)
CREATE TABLE tables (
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

-- Step 5: Create seat requests table (CRITICAL for waitlist functionality)
CREATE TABLE seat_requests (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    table_id INTEGER REFERENCES tables(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'waiting',
    position INTEGER DEFAULT 0,
    estimated_wait INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 6: Create KYC documents table (for staff portal review)
CREATE TABLE kyc_documents (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 7: Create transactions table (for admin portal tracking)
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount TEXT NOT NULL,
    description TEXT,
    staff_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 8: Insert the 9 existing players
INSERT INTO players (email, password, first_name, last_name, phone, kyc_status, balance, total_deposits, total_withdrawals, total_winnings, total_losses, games_played, hours_played) VALUES
('test@supabase.com', 'password123', 'Test', 'Player', '1234567890', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('new@supabase.com', 'password123', 'New', 'Player', '9876543210', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('supabase.direct@test.com', 'password123', 'Supabase', 'Direct', '1234567890', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('final.test@supabase.com', 'password123', 'Final', 'Test', '9876543210', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('manual.test@supabase.com', 'password123', 'Manual', 'Test', '9999999999', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('now.supabase@test.com', 'password123', 'Now', 'Supabase', '1111111111', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('test.user1@supabase.com', 'password123', 'Test', 'User1', '5555555555', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('test.user2@supabase.com', 'password123', 'Test', 'User2', '6666666666', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00'),
('test.user3@supabase.com', 'password123', 'Test', 'User3', '7777777777', 'pending', '0.00', '0.00', '0.00', '0.00', '0.00', 0, '0.00');

-- Step 9: Create sample poker tables for staff portal integration
INSERT INTO tables (name, game_type, stakes, max_players, current_players, pot, avg_stack, is_active) VALUES
('High Stakes Hold''em', 'Texas Hold''em', '₹500/₹1000', 9, 3, 15000, 125000, true),
('Mid Stakes Omaha', 'Pot Limit Omaha', '₹100/₹200', 6, 2, 5000, 45000, true),
('Low Stakes Hold''em', 'Texas Hold''em', '₹25/₹50', 9, 5, 1200, 8500, true),
('Tournament Table', 'Texas Hold''em', '₹1000 Buy-in', 8, 1, 25000, 50000, true),
('Cash Game Express', 'Texas Hold''em', '₹50/₹100', 6, 4, 2500, 12000, true);

-- Step 10: Create default preferences for all players
INSERT INTO player_prefs (player_id, seat_available, call_time_warning, game_updates)
SELECT id, TRUE, TRUE, FALSE FROM players;

-- Step 11: Insert sample seat requests to demonstrate waitlist functionality
INSERT INTO seat_requests (player_id, table_id, status, position, estimated_wait) VALUES
(1, 1, 'waiting', 1, 5),
(2, 1, 'waiting', 2, 10),
(3, 2, 'waiting', 1, 3),
(4, 3, 'waiting', 1, 2),
(5, 4, 'waiting', 1, 15);

-- Step 12: Insert sample KYC documents for staff review
INSERT INTO kyc_documents (player_id, document_type, file_name, file_url, status) VALUES
(1, 'passport', 'passport_test_player.jpg', '/uploads/kyc/passport_test_player.jpg', 'pending'),
(2, 'driving_license', 'dl_new_player.jpg', '/uploads/kyc/dl_new_player.jpg', 'pending'),
(3, 'aadhar', 'aadhar_supabase_direct.jpg', '/uploads/kyc/aadhar_supabase_direct.jpg', 'approved');

-- Step 13: Insert sample transactions for admin portal
INSERT INTO transactions (player_id, type, amount, description, staff_id) VALUES
(1, 'deposit', '10000.00', 'Initial deposit via UPI', 'staff_001'),
(2, 'deposit', '5000.00', 'Bank transfer deposit', 'staff_002'),
(3, 'win', '2500.00', 'Tournament winnings', NULL),
(4, 'deposit', '15000.00', 'Credit card deposit', 'staff_001');

-- Step 14: Verification queries
SELECT 'SETUP COMPLETE - FULL INTEGRATION READY' as status;
SELECT 'Players:' as table_name, COUNT(*) as count FROM players;
SELECT 'Tables:' as table_name, COUNT(*) as count FROM tables;
SELECT 'Seat Requests:' as table_name, COUNT(*) as count FROM seat_requests;
SELECT 'KYC Documents:' as table_name, COUNT(*) as count FROM kyc_documents;
SELECT 'Transactions:' as table_name, COUNT(*) as count FROM transactions;
SELECT 'Player Preferences:' as table_name, COUNT(*) as count FROM player_prefs;

-- Step 15: Show sample data for verification
SELECT 'PLAYERS' as data_type, id, email, first_name, last_name, kyc_status FROM players ORDER BY id LIMIT 5;
SELECT 'TABLES' as data_type, id, name, game_type, stakes, current_players, max_players FROM tables ORDER BY id;
SELECT 'SEAT REQUESTS' as data_type, sr.id, p.email, t.name as table_name, sr.status, sr.position FROM seat_requests sr JOIN players p ON sr.player_id = p.id JOIN tables t ON sr.table_id = t.id ORDER BY sr.id;