-- UNIFIED CLERK + SUPABASE AUTHENTICATION SYSTEM
-- This creates a complete unified ID system where players can be identified by ANY of these:
-- 1. clerk_user_id (Clerk authentication)
-- 2. supabase_id (Supabase auth.users.id)
-- 3. universal_id (Cross-portal unique ID)
-- 4. id (Primary key player ID)

-- Step 1: Ensure clerk_user_id column exists and is properly typed
ALTER TABLE players 
  ADD COLUMN IF NOT EXISTS clerk_user_id text,
  ADD COLUMN IF NOT EXISTS clerk_synced_at timestamptz DEFAULT now();

-- Step 2: Create comprehensive indexes for all ID lookups
CREATE INDEX IF NOT EXISTS idx_players_clerk_user_id ON players(clerk_user_id) WHERE clerk_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_supabase_id ON players(supabase_id) WHERE supabase_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_universal_id ON players(universal_id) WHERE universal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);

-- Step 3: Create unified player lookup function (ANY ID works)
CREATE OR REPLACE FUNCTION get_player_by_any_id(
  p_clerk_user_id text DEFAULT NULL,
  p_supabase_id text DEFAULT NULL,
  p_universal_id text DEFAULT NULL,
  p_player_id integer DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS TABLE(
  id integer,
  email text,
  first_name text,
  last_name text,
  phone text,
  kyc_status text,
  clerk_user_id text,
  supabase_id text,
  universal_id text,
  created_at timestamp,
  balance text,
  is_active boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, p.email, p.first_name, p.last_name, p.phone, p.kyc_status,
    p.clerk_user_id, p.supabase_id, p.universal_id, p.created_at,
    p.balance, p.is_active
  FROM players p
  WHERE 
    (p_clerk_user_id IS NOT NULL AND p.clerk_user_id = p_clerk_user_id) OR
    (p_supabase_id IS NOT NULL AND p.supabase_id = p_supabase_id) OR
    (p_universal_id IS NOT NULL AND p.universal_id = p_universal_id) OR
    (p_player_id IS NOT NULL AND p.id = p_player_id) OR
    (p_email IS NOT NULL AND p.email = p_email)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create unified player sync function (links all IDs)
CREATE OR REPLACE FUNCTION sync_player_ids(
  p_player_id integer,
  p_clerk_user_id text DEFAULT NULL,
  p_supabase_id text DEFAULT NULL,
  p_universal_id text DEFAULT NULL
)
RETURNS TABLE(
  id integer,
  clerk_user_id text,
  supabase_id text,
  universal_id text,
  synced boolean
) AS $$
BEGIN
  -- Update the player with all provided IDs
  UPDATE players 
  SET 
    clerk_user_id = COALESCE(p_clerk_user_id, players.clerk_user_id),
    supabase_id = COALESCE(p_supabase_id, players.supabase_id),
    universal_id = COALESCE(p_universal_id, players.universal_id),
    clerk_synced_at = now()
  WHERE players.id = p_player_id;
  
  -- Return the updated player
  RETURN QUERY
  SELECT 
    p.id, p.clerk_user_id, p.supabase_id, p.universal_id, true as synced
  FROM players p
  WHERE p.id = p_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create Clerk user creation function
CREATE OR REPLACE FUNCTION create_clerk_player(
  p_clerk_user_id text,
  p_email text,
  p_first_name text DEFAULT '',
  p_last_name text DEFAULT '',
  p_phone text DEFAULT ''
)
RETURNS TABLE(
  id integer,
  email text,
  clerk_user_id text,
  supabase_id text,
  universal_id text,
  kyc_status text
) AS $$
DECLARE
  new_universal_id text;
  new_supabase_id text;
  new_player_id integer;
BEGIN
  -- Generate unique IDs
  new_universal_id := 'unified_' || extract(epoch from now()) || '_' || substring(md5(random()::text) from 1 for 8);
  new_supabase_id := 'clerk_' || extract(epoch from now()) || '_' || substring(md5(random()::text) from 1 for 8);
  
  -- Insert or update player
  INSERT INTO players (
    email, first_name, last_name, phone, clerk_user_id,
    supabase_id, universal_id, kyc_status, created_at
  ) VALUES (
    p_email, p_first_name, p_last_name, p_phone, p_clerk_user_id,
    new_supabase_id, new_universal_id, 'pending', now()
  )
  ON CONFLICT (email) DO UPDATE SET
    clerk_user_id = p_clerk_user_id,
    first_name = COALESCE(NULLIF(p_first_name, ''), players.first_name),
    last_name = COALESCE(NULLIF(p_last_name, ''), players.last_name),
    phone = COALESCE(NULLIF(p_phone, ''), players.phone),
    clerk_synced_at = now()
  RETURNING players.id INTO new_player_id;
  
  -- Return the player data
  RETURN QUERY
  SELECT 
    p.id, p.email, p.clerk_user_id, p.supabase_id, p.universal_id, p.kyc_status
  FROM players p
  WHERE p.id = new_player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Update existing players with universal_id if missing
UPDATE players 
SET universal_id = 'unified_' || extract(epoch from now()) || '_' || id::text
WHERE universal_id IS NULL;

-- Step 7: Create RLS policies for Clerk authentication
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Policy for Clerk authenticated users
CREATE POLICY "Clerk users can access own data" ON players
  FOR ALL USING (
    clerk_user_id IS NOT NULL 
    AND (
      auth.jwt()->>'sub' = clerk_user_id OR
      auth.jwt()->>'user_id' = clerk_user_id OR
      auth.uid()::text = supabase_id
    )
  );

-- Policy for service role (API access)
CREATE POLICY "Service role full access" ON players
  FOR ALL USING (auth.role() = 'service_role');

-- Step 8: Create auth trigger for Supabase users
CREATE OR REPLACE FUNCTION handle_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO players (
    email, first_name, last_name, supabase_id, universal_id, kyc_status
  ) VALUES (
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.id::text,
    'unified_' || extract(epoch from now()) || '_' || substring(NEW.id::text from 1 for 8),
    'pending'
  )
  ON CONFLICT (email) DO UPDATE SET
    supabase_id = NEW.id::text,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_auth_user_created();

-- Step 9: Test the unified system
SELECT 
  'Unified ID System Setup Complete' as status,
  COUNT(*) as total_players,
  COUNT(CASE WHEN universal_id IS NOT NULL THEN 1 END) as with_universal_id,
  COUNT(CASE WHEN clerk_user_id IS NOT NULL THEN 1 END) as with_clerk_id,
  COUNT(CASE WHEN supabase_id IS NOT NULL THEN 1 END) as with_supabase_id
FROM players;

-- Test the lookup function
-- SELECT * FROM get_player_by_any_id(p_email => 'test@example.com');
-- SELECT * FROM get_player_by_any_id(p_clerk_user_id => 'user_123');
-- SELECT * FROM get_player_by_any_id(p_player_id => 1);

-- Step 10: Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_player_by_any_id TO service_role;
GRANT EXECUTE ON FUNCTION sync_player_ids TO service_role;
GRANT EXECUTE ON FUNCTION create_clerk_player TO service_role;

-- Success message
SELECT 'Unified Clerk + Supabase authentication system ready!' as final_status;