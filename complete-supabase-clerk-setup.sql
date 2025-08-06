-- Complete Supabase + Clerk Integration Setup
-- Run this script in your Supabase SQL Editor to ensure proper integration

-- 1. Update players table structure for Clerk integration
ALTER TABLE players 
  ALTER COLUMN clerk_user_id TYPE text,
  ALTER COLUMN supabase_id TYPE text,
  ALTER COLUMN universal_id TYPE text;

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_clerk_user_id ON players(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_players_supabase_id ON players(supabase_id);
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
CREATE INDEX IF NOT EXISTS idx_players_universal_id ON players(universal_id);

-- 3. Create or update auth.users integration function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-create player record when Supabase auth user is created
  INSERT INTO public.players (
    email,
    first_name,
    last_name,
    phone,
    supabase_id,
    universal_id,
    kyc_status,
    created_at
  ) VALUES (
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.id,
    'unified_' || extract(epoch from now()) || '_' || substring(NEW.id from 1 for 8),
    'pending',
    now()
  )
  ON CONFLICT (email) DO UPDATE SET
    supabase_id = NEW.id,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger for auto-syncing auth users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Enable RLS (Row Level Security) for players table
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for secure access
CREATE POLICY "Players can view own data" ON players
  FOR SELECT USING (
    auth.uid()::text = supabase_id 
    OR 
    auth.jwt()->>'email' = email
  );

CREATE POLICY "Players can update own data" ON players
  FOR UPDATE USING (
    auth.uid()::text = supabase_id 
    OR 
    auth.jwt()->>'email' = email
  );

-- 7. Allow service role full access (for API operations)
CREATE POLICY "Service role full access" ON players
  FOR ALL USING (auth.role() = 'service_role');

-- 8. Update existing players with universal_id if missing
UPDATE players 
SET universal_id = 'unified_' || extract(epoch from now()) || '_' || id::text
WHERE universal_id IS NULL;

-- 9. Create function for KYC status updates (staff portal integration)
CREATE OR REPLACE FUNCTION update_player_kyc_status(player_id INT, new_kyc_status TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE players 
  SET kyc_status = new_kyc_status,
      updated_at = now()
  WHERE id = player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Verify setup
SELECT 
  'Players table structure' as check_type,
  COUNT(*) as total_players,
  COUNT(CASE WHEN universal_id IS NOT NULL THEN 1 END) as with_universal_id,
  COUNT(CASE WHEN kyc_status = 'pending' THEN 1 END) as pending_kyc
FROM players;

-- 11. Create sample data for testing (optional - remove in production)
-- INSERT INTO players (
--   email, first_name, last_name, phone, kyc_status, 
--   supabase_id, universal_id, clerk_user_id
-- ) VALUES (
--   'test@example.com', 'Test', 'User', '9876543210', 'pending',
--   'test-supabase-id', 'unified_test_123', null
-- ) ON CONFLICT (email) DO NOTHING;

-- Success message
SELECT 'Supabase + Clerk integration setup complete!' as status;