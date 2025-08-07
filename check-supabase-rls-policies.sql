-- Check RLS policies on the players table that might be blocking access
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'players';

-- Check if RLS is enabled on players table  
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables 
WHERE tablename = 'players';

-- Temporarily disable RLS on players table for debugging (if needed)
-- ALTER TABLE public.players DISABLE ROW LEVEL SECURITY;