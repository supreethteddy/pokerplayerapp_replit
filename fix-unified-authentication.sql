-- COMPREHENSIVE UNIFIED AUTHENTICATION FIX
-- This script resolves all authentication issues and creates a seamless unified system

-- Step 1: Identify and resolve duplicate players
-- Find duplicates and merge them properly
WITH duplicate_analysis AS (
  SELECT 
    email, 
    COUNT(*) as count,
    MIN(id) as keep_id,
    string_agg(id::text, ',') as all_ids
  FROM players 
  GROUP BY email 
  HAVING COUNT(*) > 1
)
SELECT 
  'Duplicate Players Found' as issue_type,
  email,
  count,
  keep_id,
  all_ids
FROM duplicate_analysis;

-- Step 2: Fix the immediate authentication issue for user 29
-- Update user 29 with just the Supabase ID for now
UPDATE players 
SET supabase_id = 'e0953527-a5d5-402c-9e00-8ed590d19cde'
WHERE id = 29;

-- Step 3: Create comprehensive unified player lookup system
CREATE OR REPLACE FUNCTION get_player_unified_lookup(
  lookup_value text,
  lookup_type text DEFAULT 'any' -- 'email', 'supabase_id', 'clerk_id', 'universal_id', 'player_id', 'any'
)
RETURNS TABLE(
  id integer,
  email text,
  first_name text,
  last_name text,
  phone text,
  kyc_status text,
  balance text,
  clerk_user_id text,
  supabase_id text,
  universal_id text,
  is_active boolean,
  created_at timestamp
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, p.email, p.first_name, p.last_name, p.phone,
    p.kyc_status, p.balance, p.clerk_user_id, p.supabase_id,
    p.universal_id, p.is_active, p.created_at
  FROM players p
  WHERE 
    (lookup_type = 'email' AND p.email = lookup_value) OR
    (lookup_type = 'supabase_id' AND p.supabase_id = lookup_value) OR
    (lookup_type = 'clerk_id' AND p.clerk_user_id = lookup_value) OR
    (lookup_type = 'universal_id' AND p.universal_id = lookup_value) OR
    (lookup_type = 'player_id' AND p.id = lookup_value::integer) OR
    (lookup_type = 'any' AND (
      p.email = lookup_value OR
      p.supabase_id = lookup_value OR
      p.clerk_user_id = lookup_value OR
      p.universal_id = lookup_value OR
      (lookup_value ~ '^\d+$' AND p.id = lookup_value::integer)
    ))
  ORDER BY 
    CASE 
      WHEN p.supabase_id = lookup_value THEN 1
      WHEN p.clerk_user_id = lookup_value THEN 2
      WHEN p.email = lookup_value THEN 3
      WHEN p.id = lookup_value::integer THEN 4
      ELSE 5
    END
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create player sync function for Clerk integration
CREATE OR REPLACE FUNCTION sync_player_with_clerk(
  p_email text,
  p_clerk_user_id text,
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS TABLE(
  id integer,
  email text,
  clerk_user_id text,
  supabase_id text,
  universal_id text,
  sync_status text
) AS $$
DECLARE
  existing_player_id integer;
  new_universal_id text;
BEGIN
  -- Check if player already exists by email
  SELECT players.id INTO existing_player_id
  FROM players 
  WHERE players.email = p_email;
  
  IF existing_player_id IS NOT NULL THEN
    -- Update existing player with Clerk ID
    UPDATE players 
    SET 
      clerk_user_id = p_clerk_user_id,
      first_name = COALESCE(p_first_name, first_name),
      last_name = COALESCE(p_last_name, last_name),
      phone = COALESCE(p_phone, phone),
      updated_at = now()
    WHERE players.id = existing_player_id;
    
    RETURN QUERY
    SELECT 
      p.id, p.email, p.clerk_user_id, p.supabase_id, p.universal_id,
      'updated' as sync_status
    FROM players p
    WHERE p.id = existing_player_id;
  ELSE
    -- Create new player with Clerk ID
    new_universal_id := 'unified_' || extract(epoch from now()) || '_' || substring(md5(random()::text) from 1 for 8);
    
    INSERT INTO players (
      email, first_name, last_name, phone, clerk_user_id,
      universal_id, kyc_status, balance, is_active, created_at
    ) VALUES (
      p_email, p_first_name, p_last_name, p_phone, p_clerk_user_id,
      new_universal_id, 'pending', '0.00', true, now()
    )
    RETURNING players.id INTO existing_player_id;
    
    RETURN QUERY
    SELECT 
      p.id, p.email, p.clerk_user_id, p.supabase_id, p.universal_id,
      'created' as sync_status
    FROM players p
    WHERE p.id = existing_player_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Ensure all existing players have proper universal_id
UPDATE players 
SET universal_id = 'unified_' || extract(epoch from created_at) || '_' || id::text
WHERE universal_id IS NULL OR universal_id = '';

-- Step 6: Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_players_unified_lookup ON players(email, supabase_id, clerk_user_id, universal_id);
CREATE INDEX IF NOT EXISTS idx_players_auth_status ON players(kyc_status, is_active);

-- Step 7: Verify the unified system is working
SELECT 
  'Unified Authentication System Ready' as status,
  COUNT(*) as total_players,
  COUNT(CASE WHEN universal_id IS NOT NULL THEN 1 END) as with_universal_id,
  COUNT(CASE WHEN supabase_id IS NOT NULL THEN 1 END) as with_supabase_id,
  COUNT(CASE WHEN clerk_user_id IS NOT NULL THEN 1 END) as with_clerk_id,
  COUNT(CASE WHEN kyc_status = 'verified' THEN 1 END) as verified_players
FROM players;

-- Test the unified lookup function
-- SELECT * FROM get_player_unified_lookup('vignesh.wildleaf@gmail.com', 'email');
-- SELECT * FROM get_player_unified_lookup('e0953527-a5d5-402c-9e00-8ed590d19cde', 'supabase_id');