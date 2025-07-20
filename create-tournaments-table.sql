-- Create tournaments table in Staff Portal Supabase
-- This ensures tournaments are properly displayed in Player Portal

-- Create tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    tournament_type VARCHAR(100) DEFAULT 'Texas Hold''em',
    buy_in DECIMAL(10,2) DEFAULT 0.00,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    max_players INTEGER DEFAULT 100,
    registered_players INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'upcoming',
    description TEXT,
    prize_pool DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert sample tournaments for testing
INSERT INTO tournaments (name, tournament_type, buy_in, start_time, max_players, registered_players, status, description, prize_pool) VALUES
('Daily Freeroll', 'Texas Hold''em', 0.00, NOW() + INTERVAL '2 hours', 50, 23, 'registering', 'Free daily tournament with guaranteed prize pool', 5000.00),
('Weekend Warrior', 'Texas Hold''em', 500.00, NOW() + INTERVAL '1 day', 100, 45, 'registering', 'High-stakes weekend tournament', 25000.00);

-- Enable RLS
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- Create policy for staff portal access
CREATE POLICY "Staff can manage tournaments" ON tournaments
    FOR ALL USING (true);

-- Create policy for player portal read access
CREATE POLICY "Players can view tournaments" ON tournaments
    FOR SELECT USING (true);

-- Grant permissions
GRANT ALL ON tournaments TO postgres;
GRANT SELECT ON tournaments TO anon;
GRANT SELECT ON tournaments TO authenticated;

SELECT 'Tournaments table created successfully with sample data' as result;