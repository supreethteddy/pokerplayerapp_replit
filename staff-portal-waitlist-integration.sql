-- STAFF PORTAL WAITLIST INTEGRATION SETUP
-- Complete SQL script for Staff Portal Supabase to enable waitlist functionality
-- Run this in Staff Portal Supabase SQL Editor

-- 1. Create waitlist table for cross-portal waitlist management
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL,
  player_name VARCHAR(200) NOT NULL,
  player_email VARCHAR(255),
  player_phone VARCHAR(20),
  table_id UUID NOT NULL,
  table_name VARCHAR(200) NOT NULL,
  game_type VARCHAR(100) NOT NULL,
  min_buy_in DECIMAL(12,2) NOT NULL,
  max_buy_in DECIMAL(12,2) NOT NULL,
  seat_number INTEGER, -- Preferred seat number (1-10)
  position INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'waiting', -- waiting, seated, cancelled
  requested_at TIMESTAMP DEFAULT NOW(),
  seated_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  notes TEXT,
  universal_id UUID, -- For cross-portal synchronization
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create table_assignments table for staff to assign players to seats
CREATE TABLE IF NOT EXISTS table_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL,
  table_name VARCHAR(200) NOT NULL,
  player_id INTEGER NOT NULL,
  player_name VARCHAR(200) NOT NULL,
  seat_number INTEGER NOT NULL, -- Actual assigned seat (1-10)
  assigned_by VARCHAR(100) NOT NULL, -- Staff member who assigned
  assigned_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'active', -- active, completed, cancelled
  buy_in_amount DECIMAL(12,2),
  chips_allocated INTEGER,
  notes TEXT,
  universal_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create waitlist_history table for audit trail
CREATE TABLE IF NOT EXISTS waitlist_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_id UUID NOT NULL,
  player_id INTEGER NOT NULL,
  table_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL, -- joined, seated, cancelled, left
  performed_by VARCHAR(100), -- player or staff member name
  performed_by_type VARCHAR(50), -- player, staff, admin, super_admin
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  seat_number INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_waitlist_player_id ON waitlist(player_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_table_id ON waitlist(table_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_seat_number ON waitlist(seat_number);

CREATE INDEX IF NOT EXISTS idx_table_assignments_table_id ON table_assignments(table_id);
CREATE INDEX IF NOT EXISTS idx_table_assignments_player_id ON table_assignments(player_id);
CREATE INDEX IF NOT EXISTS idx_table_assignments_seat_number ON table_assignments(seat_number);

CREATE INDEX IF NOT EXISTS idx_waitlist_history_waitlist_id ON waitlist_history(waitlist_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_history_player_id ON waitlist_history(player_id);

-- 5. Create unique constraint to prevent duplicate seat assignments
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_table_seat_assignment 
ON table_assignments(table_id, seat_number) 
WHERE status = 'active';

-- 6. Insert sample waitlist data for testing (optional)
/*
-- Example waitlist entry
INSERT INTO waitlist (
  player_id,
  player_name,
  player_email,
  table_id,
  table_name,
  game_type,
  min_buy_in,
  max_buy_in,
  seat_number,
  position,
  notes,
  universal_id
) VALUES (
  29,
  'vignesh gana',
  'vignesh.wildleaf@gmail.com',
  '56551992-75ac-4248-b5e1-65417d2e4047',
  'hello123',
  'Texas Hold''em',
  100.00,
  5000.00,
  3,
  1,
  'Player requested seat 3',
  'e6e6f981-4ce2-4637-87a9-fb6b59b14d48'
);
*/

-- 7. Enable RLS (Row Level Security)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_history ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS policies
CREATE POLICY "Everyone can view waitlist" ON waitlist FOR SELECT USING (true);
CREATE POLICY "Players can insert waitlist" ON waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff can manage waitlist" ON waitlist FOR ALL USING (true);

CREATE POLICY "Everyone can view table assignments" ON table_assignments FOR SELECT USING (true);
CREATE POLICY "Staff can manage table assignments" ON table_assignments FOR ALL USING (true);

CREATE POLICY "Everyone can view waitlist history" ON waitlist_history FOR SELECT USING (true);
CREATE POLICY "Everyone can insert waitlist history" ON waitlist_history FOR INSERT WITH CHECK (true);

-- 9. Create functions for automatic history logging
CREATE OR REPLACE FUNCTION log_waitlist_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO waitlist_history (
      waitlist_id, player_id, table_id, action, 
      performed_by, performed_by_type, new_status, seat_number, notes
    ) VALUES (
      NEW.id, NEW.player_id, NEW.table_id, 'joined',
      NEW.player_name, 'player', NEW.status, NEW.seat_number, 'Player joined waitlist'
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status != NEW.status THEN
      INSERT INTO waitlist_history (
        waitlist_id, player_id, table_id, action,
        performed_by, performed_by_type, old_status, new_status, seat_number, notes
      ) VALUES (
        NEW.id, NEW.player_id, NEW.table_id, 
        CASE 
          WHEN NEW.status = 'seated' THEN 'seated'
          WHEN NEW.status = 'cancelled' THEN 'cancelled'
          ELSE 'status_changed'
        END,
        COALESCE(NEW.notes, 'System'), 'staff', OLD.status, NEW.status, NEW.seat_number,
        'Status changed from ' || OLD.status || ' to ' || NEW.status
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO waitlist_history (
      waitlist_id, player_id, table_id, action,
      performed_by, performed_by_type, old_status, notes
    ) VALUES (
      OLD.id, OLD.player_id, OLD.table_id, 'left',
      OLD.player_name, 'player', OLD.status, 'Player left waitlist'
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 10. Create triggers for automatic history logging
CREATE TRIGGER waitlist_history_trigger
  AFTER INSERT OR UPDATE OR DELETE ON waitlist
  FOR EACH ROW EXECUTE FUNCTION log_waitlist_change();

-- 11. Comments for documentation
COMMENT ON TABLE waitlist IS 'Cross-portal waitlist management for Player Portal and Staff Portal';
COMMENT ON TABLE table_assignments IS 'Staff-managed table seat assignments';
COMMENT ON TABLE waitlist_history IS 'Audit trail for all waitlist activities';

-- USAGE INSTRUCTIONS:
-- 1. Player Portal: Uses /api/waitlist/join to add players to waitlist with seat preference
-- 2. Staff Portal: Uses /api/staff/waitlist/table/:tableId to view and manage waitlist
-- 3. Staff Portal: Uses /api/staff/assign-player to assign players to specific seats
-- 4. All changes are automatically logged in waitlist_history for audit purposes
-- 5. Real-time sync ensures Player Portal and Staff Portal see identical waitlist data