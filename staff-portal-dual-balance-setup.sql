-- STAFF PORTAL DUAL BALANCE SYSTEM SETUP
-- Complete SQL script for Staff Portal Supabase to enable dual balance functionality
-- Run this in Staff Portal Supabase SQL Editor

-- 1. Create credit_requests table for credit limit management
CREATE TABLE IF NOT EXISTS credit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL,
  requested_amount DECIMAL(12,2) NOT NULL,
  current_credit_limit DECIMAL(12,2) DEFAULT 0.00,
  new_credit_limit DECIMAL(12,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  requested_by VARCHAR(100), -- Staff member who created request
  reviewed_by VARCHAR(100), -- Super admin who approved/rejected
  request_reason TEXT,
  review_notes TEXT,
  requested_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create account_balances table for dual balance management
CREATE TABLE IF NOT EXISTS account_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL UNIQUE,
  regular_balance DECIMAL(12,2) DEFAULT 0.00,
  credit_limit DECIMAL(12,2) DEFAULT 0.00,
  available_credit DECIMAL(12,2) DEFAULT 0.00,
  total_deposits DECIMAL(12,2) DEFAULT 0.00,
  total_withdrawals DECIMAL(12,2) DEFAULT 0.00,
  last_transaction_id UUID,
  updated_by VARCHAR(100), -- Staff member who made last change
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create balance_transactions table for audit trail
CREATE TABLE IF NOT EXISTS balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- deposit, withdrawal, credit_adjustment, balance_adjustment
  amount DECIMAL(12,2) NOT NULL,
  balance_type VARCHAR(50) NOT NULL, -- regular, credit
  old_balance DECIMAL(12,2) NOT NULL,
  new_balance DECIMAL(12,2) NOT NULL,
  description TEXT,
  processed_by VARCHAR(100) NOT NULL, -- Staff member who processed
  staff_portal_origin VARCHAR(50), -- cashier, admin, super_admin
  reference_id UUID, -- Link to credit_request or other reference
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_credit_requests_player_id ON credit_requests(player_id);
CREATE INDEX IF NOT EXISTS idx_credit_requests_status ON credit_requests(status);
CREATE INDEX IF NOT EXISTS idx_account_balances_player_id ON account_balances(player_id);
CREATE INDEX IF NOT EXISTS idx_balance_transactions_player_id ON balance_transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_balance_transactions_type ON balance_transactions(transaction_type);

-- 5. Insert initial balance record for existing players (adjust player IDs as needed)
-- Example for player 29 (modify as per your system)
INSERT INTO account_balances (player_id, regular_balance, credit_limit, available_credit) 
VALUES (29, 0.00, 0.00, 0.00)
ON CONFLICT (player_id) DO UPDATE SET
  updated_at = NOW();

-- 6. Create RLS (Row Level Security) policies if needed
-- Enable RLS
ALTER TABLE credit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for staff access (adjust as per your authentication system)
CREATE POLICY "Staff can view all credit requests" ON credit_requests FOR SELECT USING (true);
CREATE POLICY "Staff can insert credit requests" ON credit_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff can update credit requests" ON credit_requests FOR UPDATE USING (true);

CREATE POLICY "Staff can view all account balances" ON account_balances FOR SELECT USING (true);
CREATE POLICY "Staff can manage account balances" ON account_balances FOR ALL USING (true);

CREATE POLICY "Staff can view balance transactions" ON balance_transactions FOR SELECT USING (true);
CREATE POLICY "Staff can insert balance transactions" ON balance_transactions FOR INSERT WITH CHECK (true);

-- 7. Sample data for testing (optional)
/*
-- Example credit request
INSERT INTO credit_requests (
  player_id, 
  requested_amount, 
  current_credit_limit, 
  new_credit_limit, 
  requested_by, 
  request_reason
) VALUES (
  29, 
  5000.00, 
  0.00, 
  5000.00, 
  'Staff Portal Admin', 
  'Player requested credit limit for high-stakes games'
);

-- Example balance adjustment
INSERT INTO balance_transactions (
  player_id,
  transaction_type,
  amount,
  balance_type,
  old_balance,
  new_balance,
  description,
  processed_by,
  staff_portal_origin
) VALUES (
  29,
  'deposit',
  1000.00,
  'regular',
  0.00,
  1000.00,
  'Initial deposit by cashier',
  'Cashier001',
  'cashier'
);
*/

-- 8. Comments for documentation
COMMENT ON TABLE credit_requests IS 'Manages credit limit requests and approvals';
COMMENT ON TABLE account_balances IS 'Stores dual balance system: regular balance and credit limit';
COMMENT ON TABLE balance_transactions IS 'Audit trail for all balance changes';

-- USAGE INSTRUCTIONS:
-- 1. Regular Balance: Managed by cashier/admin via /api/staff/balance-adjustment
-- 2. Credit Limit: Requested via /api/staff/credit-request, approved by super admin via /api/admin/credit-request/:id/review
-- 3. All changes are logged in balance_transactions for audit purposes
-- 4. Player Portal displays both balances via /api/account-balance/:playerId
-- 5. Real-time sync ensures Staff Portal changes appear instantly in Player Portal