-- STAFF PORTAL DATABASE SCHEMA REPAIR SCRIPT
-- This script fixes the schema issues preventing API functionality

-- First, check and fix the push_notifications table
DO $$
BEGIN
    -- Check if target_player_id column exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'push_notifications' 
        AND column_name = 'target_player_id'
    ) THEN
        -- If the column doesn't exist, we need to understand the current structure
        -- and map it correctly
        RAISE NOTICE 'target_player_id column does not exist in push_notifications';
    ELSE
        RAISE NOTICE 'target_player_id column exists in push_notifications';
    END IF;
END $$;

-- Check and fix the waitlist table seat_number column
DO $$
BEGIN
    -- Check if seat_number column exists in waitlist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'waitlist' 
        AND column_name = 'seat_number'
    ) THEN
        ALTER TABLE waitlist ADD COLUMN seat_number INTEGER;
        RAISE NOTICE 'Added seat_number column to waitlist table';
    ELSE
        RAISE NOTICE 'seat_number column already exists in waitlist table';
    END IF;
END $$;

-- Show the actual structure of push_notifications table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'push_notifications' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show the actual structure of waitlist table
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'waitlist' 
AND table_schema = 'public'
ORDER BY ordinal_position;