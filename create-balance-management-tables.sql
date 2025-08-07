-- Three-Tier Balance Management System Database Setup
-- This creates the complete balance infrastructure for Player Portal integration

-- Transactions table for all balance operations
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    type VARCHAR(20) NOT NULL, -- 'cash_in', 'cash_out', 'table_buy_in', 'table_cash_out'
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    staff_id VARCHAR(50), -- ID of cashier or manager who processed
    table_id VARCHAR(50), -- Table ID for table operations
    session_id VARCHAR(50), -- Game session ID for tracking
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Cash-Out Requests table for cashier processing
CREATE TABLE IF NOT EXISTS cash_out_requests (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    amount DECIMAL(12,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'completed', 'rejected'
    requested_at TIMESTAMP NOT NULL,
    processed_at TIMESTAMP,
    processed_by VARCHAR(50), -- Staff member who processed
    player_name VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table Sessions for tracking player buy-ins/cash-outs
CREATE TABLE IF NOT EXISTS table_sessions (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    table_id VARCHAR(50) NOT NULL,
    buy_in_amount DECIMAL(12,2) NOT NULL,
    current_chips DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed'
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_player_id ON transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_cash_out_requests_player_id ON cash_out_requests(player_id);
CREATE INDEX IF NOT EXISTS idx_cash_out_requests_status ON cash_out_requests(status);

CREATE INDEX IF NOT EXISTS idx_table_sessions_player_id ON table_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cash_out_requests_updated_at ON cash_out_requests;
CREATE TRIGGER update_cash_out_requests_updated_at 
    BEFORE UPDATE ON cash_out_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_table_sessions_updated_at ON table_sessions;
CREATE TRIGGER update_table_sessions_updated_at 
    BEFORE UPDATE ON table_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample transactions for testing (Player ID 29)
INSERT INTO transactions (player_id, type, amount, description, staff_id) VALUES
(29, 'cash_in', 70000.00, 'Initial deposit by cashier', 'cashier_001'),
(29, 'table_buy_in', 5000.00, 'Buy-in at Table #1', 'manager_001'),
(29, 'table_cash_out', 2000.00, 'Cash-out from Table #1', 'manager_001')
ON CONFLICT DO NOTHING;

-- Update player balance to reflect the transactions  
UPDATE players 
SET balance = 67000.00, 
    updated_at = NOW()
WHERE id = 29;

SELECT 'Balance Management Tables Created Successfully' AS status;