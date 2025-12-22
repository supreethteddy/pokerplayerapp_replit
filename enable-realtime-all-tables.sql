-- Enable Supabase Realtime for player portal tables
-- This script safely checks if tables exist before enabling Realtime
-- Run this in your Supabase SQL Editor

-- First, let's check which tables actually exist
DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    -- Enable Realtime for players table (balance updates)
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'players'
    ) INTO table_exists;
    
    IF table_exists THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE players;
        RAISE NOTICE '✅ Enabled Realtime for: players';
    ELSE
        RAISE NOTICE '⚠️ Table "players" does not exist - skipping';
    END IF;

    -- Enable Realtime for tables table (table status updates)
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'tables'
    ) INTO table_exists;
    
    IF table_exists THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE tables;
        RAISE NOTICE '✅ Enabled Realtime for: tables';
    ELSE
        RAISE NOTICE '⚠️ Table "tables" does not exist - skipping';
    END IF;

    -- Enable Realtime for waitlist table (waitlist updates)
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'waitlist'
    ) INTO table_exists;
    
    IF table_exists THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE waitlist;
        RAISE NOTICE '✅ Enabled Realtime for: waitlist';
    ELSE
        RAISE NOTICE '⚠️ Table "waitlist" does not exist - skipping';
    END IF;

    -- Enable Realtime for transactions table (transaction updates)
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions'
    ) INTO table_exists;
    
    IF table_exists THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
        RAISE NOTICE '✅ Enabled Realtime for: transactions';
    ELSE
        RAISE NOTICE '⚠️ Table "transactions" does not exist - skipping';
    END IF;

    -- Already enabled (from previous scripts - these should already be enabled):
    -- push_notifications, staff_offers, offer_banners, ads_offers
    -- If you need to enable them, uncomment below:
    
    /*
    -- Enable Realtime for push_notifications (if not already enabled)
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'push_notifications'
    ) INTO table_exists;
    
    IF table_exists THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE push_notifications;
            RAISE NOTICE '✅ Enabled Realtime for: push_notifications';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ push_notifications already enabled or error: %', SQLERRM;
        END;
    END IF;

    -- Enable Realtime for staff_offers (if not already enabled)
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'staff_offers'
    ) INTO table_exists;
    
    IF table_exists THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE staff_offers;
            RAISE NOTICE '✅ Enabled Realtime for: staff_offers';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ staff_offers already enabled or error: %', SQLERRM;
        END;
    END IF;

    -- Enable Realtime for offer_banners (if not already enabled)
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'offer_banners'
    ) INTO table_exists;
    
    IF table_exists THEN
        BEGIN
            ALTER PUBLICATION supabase_realtime ADD TABLE offer_banners;
            RAISE NOTICE '✅ Enabled Realtime for: offer_banners';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ offer_banners already enabled or error: %', SQLERRM;
        END;
    END IF;
    */

END $$;

-- Verify which tables are enabled for Realtime
SELECT 
    schemaname, 
    tablename,
    'Enabled' as status
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN (
    'players',
    'tables', 
    'waitlist',
    'transactions',
    'push_notifications',
    'staff_offers',
    'offer_banners',
    'ads_offers'
)
ORDER BY tablename;

