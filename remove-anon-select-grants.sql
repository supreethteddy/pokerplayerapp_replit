-- ============================================================
-- REMOVE ANON SELECT GRANTS — All realtime tables
-- Now that all Supabase Realtime subscriptions have been
-- migrated to Socket.IO (with JWT auth), we no longer need
-- anon/authenticated SELECT access to any table.
--
-- After this script:
--   - anon role: CANNOT read any table (no more data leaks)
--   - authenticated role: CANNOT read/write any table
--   - service_role: FULL access (NestJS backend)
--
-- Supabase Realtime is no longer used from the frontend.
-- All real-time updates go through Socket.IO + JWT.
-- ============================================================

-- Tables that previously had anon/authenticated SELECT policies for Realtime
DO $$
DECLARE
  t text;
  realtime_tables text[] := ARRAY[
    'buyin_requests',
    'buyout_requests',
    'credit_requests',
    'waitlist_entries',
    'tables',
    'tournaments',
    'tournament_players',
    'tournament_registrations',
    'fnb_orders',
    'push_notifications',
    'notification_read_status',
    'player_profile_change_requests',
    'leave_applications',
    'financial_transactions',
    'chat_messages',
    'chat_sessions',
    'staff_offers',
    'offer_banners',
    'players',
    'staff'
  ];
  anon_policies text[] := ARRAY[
    '_anon_select',
    '_authenticated_select'
  ];
  p text;
BEGIN
  FOREACH t IN ARRAY realtime_tables
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      FOREACH p IN ARRAY anon_policies
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || p, t);
      END LOOP;
      RAISE NOTICE 'Removed anon/authenticated SELECT policies from table: %', t;
    END IF;
  END LOOP;
END $$;

-- Verify: after this script, no anon or authenticated SELECT policies should exist
-- on tables that previously had them for Supabase Realtime.
-- service_role ALL policies remain intact (backend still has full access).

SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (roles @> ARRAY['anon'] OR roles @> ARRAY['authenticated'])
ORDER BY tablename, policyname;
