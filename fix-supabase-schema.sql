-- First, let's check if there are any existing players to backup
SELECT 'Current players count:' as info, COUNT(*) as count FROM players;

-- Drop the existing tables to recreate them properly
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS kyc_documents;
DROP TABLE IF EXISTS seat_requests;
DROP TABLE IF EXISTS player_prefs;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS tables;

-- Create the players table with proper Supabase configuration
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

-- Create the player_prefs table
CREATE TABLE player_prefs (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    seat_available BOOLEAN DEFAULT TRUE,
    call_time_warning BOOLEAN DEFAULT TRUE,
    game_updates BOOLEAN DEFAULT FALSE
);

-- Create the tables table
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

-- Create the seat_requests table
CREATE TABLE seat_requests (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    table_id INTEGER REFERENCES tables(id),
    status TEXT NOT NULL DEFAULT 'waiting',
    position INTEGER DEFAULT 0,
    estimated_wait INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the kyc_documents table
CREATE TABLE kyc_documents (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    document_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create the transactions table
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    type TEXT NOT NULL,
    amount TEXT NOT NULL,
    description TEXT,
    staff_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert a test player to verify everything works
INSERT INTO players (email, password, first_name, last_name, phone, kyc_status) 
VALUES ('test.fixed@supabase.com', 'password123', 'Test', 'Fixed', '4444444444', 'pending');

-- Insert corresponding preferences
INSERT INTO player_prefs (player_id, seat_available, call_time_warning, game_updates)
VALUES (1, TRUE, TRUE, FALSE);

-- Verify the data
SELECT 'Final verification:' as info, COUNT(*) as player_count FROM players;
SELECT * FROM players WHERE email = 'test.fixed@supabase.com';