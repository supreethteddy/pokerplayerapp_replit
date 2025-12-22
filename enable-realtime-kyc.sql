-- Enable Realtime for players table to get KYC status updates
-- This allows players to receive instant notifications when their KYC is approved

-- Check if players table exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'players') THEN
        -- Enable Realtime for players table
        ALTER PUBLICATION supabase_realtime ADD TABLE players;
        RAISE NOTICE 'Realtime enabled for players table';
    ELSE
        RAISE NOTICE 'Players table does not exist, skipping...';
    END IF;
END $$;

-- Confirm publication
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'players';
