-- ========== COMPLETE CLERK X SUPABASE INTEGRATION SQL ==========
-- Paste this in your Supabase SQL Editor to ensure all required tables exist

-- 1. Ensure players table has all Clerk columns
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS clerk_user_id TEXT,
ADD COLUMN IF NOT EXISTS clerk_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster Clerk user lookups
CREATE INDEX IF NOT EXISTS idx_players_clerk_user_id ON players(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);

-- 2. Create clerk_webhook_events table for audit logging
CREATE TABLE IF NOT EXISTS clerk_webhook_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    clerk_user_id TEXT,
    email TEXT,
    webhook_payload JSONB NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT,
    success BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_clerk_webhook_events_type ON clerk_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_clerk_webhook_events_user ON clerk_webhook_events(clerk_user_id);

-- 3. Create clerk_sync_log table for debugging
CREATE TABLE IF NOT EXISTS clerk_sync_log (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    clerk_user_id TEXT NOT NULL,
    sync_type VARCHAR(50) NOT NULL, -- 'create', 'update', 'webhook'
    sync_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    success BOOLEAN DEFAULT true,
    error_details TEXT
);

-- 4. Update existing players to have proper defaults
UPDATE players 
SET 
    clerk_synced_at = created_at,
    email_verified = true,
    last_login_at = created_at
WHERE clerk_user_id IS NOT NULL AND clerk_synced_at IS NULL;

-- 5. Enable Row Level Security (RLS) for new tables
ALTER TABLE clerk_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE clerk_sync_log ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
CREATE POLICY IF NOT EXISTS "Service role can manage webhook events" 
ON clerk_webhook_events FOR ALL 
TO service_role 
USING (true);

CREATE POLICY IF NOT EXISTS "Service role can manage sync log" 
ON clerk_sync_log FOR ALL 
TO service_role 
USING (true);

-- 6. Create function to automatically update clerk_synced_at
CREATE OR REPLACE FUNCTION update_clerk_synced_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.clerk_synced_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic clerk_synced_at updates
DROP TRIGGER IF EXISTS trigger_update_clerk_synced_at ON players;
CREATE TRIGGER trigger_update_clerk_synced_at
    BEFORE UPDATE ON players
    FOR EACH ROW
    WHEN (OLD.clerk_user_id IS DISTINCT FROM NEW.clerk_user_id)
    EXECUTE FUNCTION update_clerk_synced_at();

-- 7. Create view for Clerk-integrated players
CREATE OR REPLACE VIEW clerk_players AS
SELECT 
    p.*,
    CASE 
        WHEN p.clerk_user_id IS NOT NULL THEN 'clerk'
        WHEN p.supabase_id IS NOT NULL THEN 'supabase'
        ELSE 'legacy'
    END as auth_type,
    CASE 
        WHEN p.clerk_user_id IS NOT NULL THEN true
        ELSE false
    END as is_clerk_managed
FROM players p;

-- 8. Verify the setup
SELECT 
    'clerk_user_id column exists' as check_name,
    CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.columns 
WHERE table_name = 'players' AND column_name = 'clerk_user_id'

UNION ALL

SELECT 
    'clerk_webhook_events table exists' as check_name,
    CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.tables 
WHERE table_name = 'clerk_webhook_events'

UNION ALL

SELECT 
    'clerk_sync_log table exists' as check_name,
    CASE WHEN COUNT(*) > 0 THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM information_schema.tables 
WHERE table_name = 'clerk_sync_log'

UNION ALL

SELECT 
    'existing_clerk_players' as check_name,
    CONCAT(COUNT(*), ' players with Clerk IDs') as status
FROM players 
WHERE clerk_user_id IS NOT NULL;

-- ========== SUMMARY ==========
-- This script ensures:
-- ✅ Players table has all required Clerk columns
-- ✅ Webhook event logging table exists
-- ✅ Sync audit logging exists  
-- ✅ Proper indexes for performance
-- ✅ RLS policies for security
-- ✅ Automatic triggers for data consistency
-- ✅ Verification of setup