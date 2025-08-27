
-- Sync existing auth.users to players table
INSERT INTO public.players (
  email,
  first_name,
  last_name,
  phone,
  password,
  supabase_id,
  kyc_status,
  balance,
  is_active,
  email_verified,
  credit_approved,
  credit_limit,
  current_credit,
  total_deposits,
  total_withdrawals,
  total_winnings,
  total_losses,
  games_played,
  hours_played,
  universal_id,
  created_at
)
SELECT 
  au.email,
  COALESCE(au.raw_user_meta_data->>'first_name', ''),
  COALESCE(au.raw_user_meta_data->>'last_name', ''),
  COALESCE(au.raw_user_meta_data->>'phone', ''),
  'supabase_managed',
  au.id,
  'pending',
  '0.00',
  true,
  CASE WHEN au.email_confirmed_at IS NOT NULL THEN true ELSE false END,
  false,
  '0.00',
  '0.00',
  '0.00',
  '0.00',
  '0.00',
  '0.00',
  0,
  '0.00',
  'unified_' || extract(epoch from now()) || '_' || substring(au.id from 1 for 8),
  au.created_at
FROM auth.users au
LEFT JOIN public.players p ON p.email = au.email
WHERE p.email IS NULL;

-- Update existing players with missing supabase_id
UPDATE public.players 
SET 
  supabase_id = au.id,
  email_verified = CASE WHEN au.email_confirmed_at IS NOT NULL THEN true ELSE false END,
  updated_at = NOW()
FROM auth.users au
WHERE players.email = au.email 
  AND players.supabase_id IS NULL;

-- Show results
SELECT 
  p.id as player_id,
  p.email,
  p.supabase_id,
  p.kyc_status,
  p.email_verified
FROM public.players p
WHERE p.email = 'test3new3@gmail.com';
