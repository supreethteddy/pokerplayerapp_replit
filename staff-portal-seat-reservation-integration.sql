-- Staff Portal Seat Reservation Integration
-- This script adds seat reservation support to the Staff Portal database

-- Add seat_number column to waitlist table if it doesn't exist
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS seat_number INTEGER;

-- Add index for efficient seat reservation queries
CREATE INDEX IF NOT EXISTS idx_waitlist_seat_table ON waitlist(table_id, seat_number);

-- Add comment to explain the seat reservation system
COMMENT ON COLUMN waitlist.seat_number IS 'Reserved seat number (1-9). Multiple players can reserve the same seat number.';

-- Sample query to view seat reservations for managers
-- SELECT 
--   w.id,
--   w.table_id,
--   w.seat_number,
--   w.position,
--   w.status,
--   w.notes,
--   p.first_name || ' ' || p.last_name as player_name,
--   p.email,
--   p.phone,
--   pt.name as table_name,
--   pt.game_type,
--   w.requested_at,
--   w.created_at
-- FROM waitlist w
-- JOIN players p ON w.player_id = p.id
-- JOIN poker_tables pt ON w.table_id = pt.id
-- WHERE w.status = 'waiting'
-- ORDER BY w.table_id, w.seat_number, w.position;

-- API endpoints for Staff Portal to manage seat reservations:
-- GET /api/waitlist/table/{tableId} - Get all waitlist entries for a table (includes seat numbers)
-- GET /api/waitlist/seat/{tableId}/{seatNumber} - Get all players who reserved a specific seat
-- POST /api/waitlist/assign-seat/{waitlistId} - Assign player to actual seat
-- PUT /api/waitlist/update-status/{waitlistId} - Update waitlist status (waiting, seated, cancelled)

-- For manager portal integration:
-- The manager can see all seat reservations grouped by table and seat number
-- Multiple players can reserve the same seat number
-- Final seating is managed by staff through the Staff Portal