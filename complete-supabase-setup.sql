-- COMPLETE SUPABASE DATABASE SETUP FOR POKER ROOM SYSTEM
-- This script ensures all required tables exist for full cross-portal functionality

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table (core user data)
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected')),
    balance DECIMAL(12,2) DEFAULT 0.00,
    total_deposits DECIMAL(12,2) DEFAULT 0.00,
    total_withdrawals DECIMAL(12,2) DEFAULT 0.00,
    total_winnings DECIMAL(12,2) DEFAULT 0.00,
    total_losses DECIMAL(12,2) DEFAULT 0.00,
    games_played INTEGER DEFAULT 0,
    hours_played DECIMAL(10,2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KYC Documents table
CREATE TABLE IF NOT EXISTS kyc_documents (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('government_id', 'utility_bill', 'profile_photo')),
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tables (poker game tables)
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    game_type VARCHAR(50) NOT NULL DEFAULT 'Texas Hold''em',
    min_buy_in DECIMAL(10,2) NOT NULL,
    max_buy_in DECIMAL(10,2) NOT NULL,
    small_blind DECIMAL(10,2) NOT NULL,
    big_blind DECIMAL(10,2) NOT NULL,
    max_players INTEGER NOT NULL DEFAULT 9,
    current_players INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seat Requests (waitlist management)
CREATE TABLE IF NOT EXISTS seat_requests (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'seated', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player Preferences
CREATE TABLE IF NOT EXISTS player_preferences (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    sound_notifications BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    auto_rebuy BOOLEAN DEFAULT false,
    auto_rebuy_amount DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions (financial tracking)
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'bet', 'win', 'loss')),
    amount DECIMAL(12,2) NOT NULL,
    balance_before DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    description TEXT,
    table_id UUID REFERENCES tables(id),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game Sessions
CREATE TABLE IF NOT EXISTS game_sessions (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
    buy_in_amount DECIMAL(10,2) NOT NULL,
    cash_out_amount DECIMAL(10,2) DEFAULT 0.00,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER DEFAULT 0,
    hands_played INTEGER DEFAULT 0,
    profit_loss DECIMAL(12,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned'))
);

-- Table Assignments (for staff management)
CREATE TABLE IF NOT EXISTS table_assignments (
    id SERIAL PRIMARY KEY,
    table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
    assigned_to VARCHAR(100), -- Staff member or manager
    assignment_type VARCHAR(20) DEFAULT 'dealer' CHECK (assignment_type IN ('dealer', 'manager', 'supervisor')),
    shift_start TIMESTAMP WITH TIME ZONE,
    shift_end TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'break')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Logs (audit trail)
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    action VARCHAR(100) NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
CREATE INDEX IF NOT EXISTS idx_players_kyc_status ON players(kyc_status);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_player_id ON kyc_documents(player_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_status ON kyc_documents(status);
CREATE INDEX IF NOT EXISTS idx_seat_requests_player_id ON seat_requests(player_id);
CREATE INDEX IF NOT EXISTS idx_seat_requests_table_id ON seat_requests(table_id);
CREATE INDEX IF NOT EXISTS idx_seat_requests_status ON seat_requests(status);
CREATE INDEX IF NOT EXISTS idx_transactions_player_id ON transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_game_sessions_player_id ON game_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_table_id ON game_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_assignments_table_id ON table_assignments(table_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_player_id ON system_logs(player_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action);

-- Insert sample Indian poker room tables if they don't exist
INSERT INTO tables (name, game_type, min_buy_in, max_buy_in, small_blind, big_blind, max_players, current_players, status)
SELECT * FROM (VALUES
    ('Mumbai High Stakes', 'Texas Hold''em', 10000.00, 100000.00, 250.00, 500.00, 9, 0, 'active'),
    ('Delhi Classic', 'Texas Hold''em', 5000.00, 50000.00, 125.00, 250.00, 9, 0, 'active'),
    ('Bangalore Tech Hub', 'Texas Hold''em', 2000.00, 20000.00, 50.00, 100.00, 9, 0, 'active'),
    ('Chennai Express', 'Texas Hold''em', 1000.00, 10000.00, 25.00, 50.00, 9, 0, 'active'),
    ('Hyderabad Heroes', 'Texas Hold''em', 500.00, 5000.00, 12.50, 25.00, 9, 0, 'active'),
    ('Kolkata Kings', 'Texas Hold''em', 250.00, 2500.00, 6.25, 12.50, 9, 0, 'active'),
    ('Pune Power', 'Texas Hold''em', 100.00, 1000.00, 2.50, 5.00, 9, 0, 'active'),
    ('Gurgaon Gold', 'Texas Hold''em', 50.00, 500.00, 1.25, 2.50, 9, 0, 'active')
) AS t(name, game_type, min_buy_in, max_buy_in, small_blind, big_blind, max_players, current_players, status)
WHERE NOT EXISTS (SELECT 1 FROM tables WHERE name = t.name);

-- Create default player preferences for existing players
INSERT INTO player_preferences (player_id, sound_notifications, email_notifications, auto_rebuy, auto_rebuy_amount)
SELECT p.id, true, true, false, 0.00
FROM players p
WHERE NOT EXISTS (SELECT 1 FROM player_preferences pp WHERE pp.player_id = p.id);

-- Create or update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to relevant tables
DROP TRIGGER IF EXISTS update_players_updated_at ON players;
CREATE TRIGGER update_players_updated_at 
    BEFORE UPDATE ON players 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kyc_documents_updated_at ON kyc_documents;
CREATE TRIGGER update_kyc_documents_updated_at 
    BEFORE UPDATE ON kyc_documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tables_updated_at ON tables;
CREATE TRIGGER update_tables_updated_at 
    BEFORE UPDATE ON tables 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_seat_requests_updated_at ON seat_requests;
CREATE TRIGGER update_seat_requests_updated_at 
    BEFORE UPDATE ON seat_requests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_player_preferences_updated_at ON player_preferences;
CREATE TRIGGER update_player_preferences_updated_at 
    BEFORE UPDATE ON player_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for enhanced security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for player data access
CREATE POLICY "Players can view their own data" ON players
    FOR SELECT USING (auth.uid()::text = email OR auth.role() = 'service_role');

CREATE POLICY "Players can update their own data" ON players
    FOR UPDATE USING (auth.uid()::text = email OR auth.role() = 'service_role');

CREATE POLICY "Service role can manage all players" ON players
    FOR ALL USING (auth.role() = 'service_role');

-- Create RLS policies for KYC documents
CREATE POLICY "Players can view their own KYC documents" ON kyc_documents
    FOR SELECT USING (
        player_id IN (SELECT id FROM players WHERE auth.uid()::text = email) 
        OR auth.role() = 'service_role'
    );

CREATE POLICY "Service role can manage all KYC documents" ON kyc_documents
    FOR ALL USING (auth.role() = 'service_role');

-- Create RLS policies for seat requests
CREATE POLICY "Players can view their own seat requests" ON seat_requests
    FOR SELECT USING (
        player_id IN (SELECT id FROM players WHERE auth.uid()::text = email) 
        OR auth.role() = 'service_role'
    );

CREATE POLICY "Service role can manage all seat requests" ON seat_requests
    FOR ALL USING (auth.role() = 'service_role');

-- Tables are public (read-only for players)
ALTER TABLE tables DISABLE ROW LEVEL SECURITY;

-- Create storage buckets for file uploads (all player KYC uses kyc-docs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-docs', 'kyc-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
CREATE POLICY "Players can upload their own KYC documents" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'kyc-docs' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Players can view their own KYC documents" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'kyc-docs' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Service role can manage all KYC documents" ON storage.objects
    FOR ALL USING (auth.role() = 'service_role' AND bucket_id = 'kyc-docs');

-- Create views for reporting and analytics
CREATE OR REPLACE VIEW player_stats AS
SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.kyc_status,
    p.balance,
    p.total_deposits,
    p.total_withdrawals,
    p.total_winnings,
    p.total_losses,
    p.games_played,
    p.hours_played,
    COUNT(sr.id) as active_seat_requests,
    COUNT(gs.id) as total_sessions,
    AVG(gs.profit_loss) as avg_profit_loss
FROM players p
LEFT JOIN seat_requests sr ON p.id = sr.player_id AND sr.status = 'waiting'
LEFT JOIN game_sessions gs ON p.id = gs.player_id
GROUP BY p.id, p.email, p.first_name, p.last_name, p.kyc_status, p.balance, 
         p.total_deposits, p.total_withdrawals, p.total_winnings, p.total_losses, 
         p.games_played, p.hours_played;

CREATE OR REPLACE VIEW table_summary AS
SELECT 
    t.id,
    t.name,
    t.game_type,
    t.min_buy_in,
    t.max_buy_in,
    t.small_blind,
    t.big_blind,
    t.max_players,
    t.current_players,
    t.status,
    COUNT(sr.id) as waiting_players,
    COUNT(gs.id) as active_sessions,
    AVG(gs.buy_in_amount) as avg_buy_in
FROM tables t
LEFT JOIN seat_requests sr ON t.id = sr.table_id AND sr.status = 'waiting'
LEFT JOIN game_sessions gs ON t.id = gs.table_id AND gs.status = 'active'
GROUP BY t.id, t.name, t.game_type, t.min_buy_in, t.max_buy_in, 
         t.small_blind, t.big_blind, t.max_players, t.current_players, t.status;

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Success message
SELECT 'Complete Supabase database setup finished successfully!' as status;