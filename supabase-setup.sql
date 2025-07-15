-- ===============================================
-- SUPABASE DATABASE SETUP - COPY PASTE THIS
-- ===============================================

-- Step 1: Create the players table
CREATE TABLE IF NOT EXISTS players (
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

-- Step 2: Create other required tables
CREATE TABLE IF NOT EXISTS player_prefs (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    seat_available BOOLEAN DEFAULT TRUE,
    call_time_warning BOOLEAN DEFAULT TRUE,
    game_updates BOOLEAN DEFAULT FALSE
);

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

CREATE TABLE IF NOT EXISTS seat_requests (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    table_id INTEGER REFERENCES tables(id),
    status TEXT NOT NULL DEFAULT 'waiting',
    position INTEGER DEFAULT 0,
    estimated_wait INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_documents (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    type TEXT NOT NULL,
    amount TEXT NOT NULL,
    description TEXT,
    staff_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Insert your existing 9 players
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
ON CONFLICT (email) DO NOTHING;

-- Step 4: Create default preferences for all players
INSERT INTO player_prefs (player_id, seat_available, call_time_warning, game_updates)
SELECT id, TRUE, TRUE, FALSE FROM players
WHERE id NOT IN (SELECT player_id FROM player_prefs WHERE player_id IS NOT NULL);

-- Step 5: Verify the data
SELECT 'Players created:' as info, COUNT(*) as count FROM players;
SELECT id, email, first_name, last_name FROM players ORDER BY id;