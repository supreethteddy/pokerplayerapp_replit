-- Apply RLS policies for all realtime tables used across:
-- - pokerplayerapp_replit (player portal)
-- - poker (staff portal)
--
-- IMPORTANT:
-- This is a compatibility-first policy set so existing realtime subscriptions
-- continue to work after RLS was enabled on all tables.
--
-- It grants SELECT to anon + authenticated for the listed realtime tables.
-- This keeps current frontend Supabase Realtime flows working, including places
-- where clients may not have Supabase Auth session tokens.
--
-- After production stabilizes, tighten these policies per table (club/player scoped).

DO $$
DECLARE
  t text;
  realtime_tables text[] := ARRAY[
    'credit_requests',
    'leave_applications',
    'chat_messages',
    'chat_sessions',
    'push_notifications',
    'notification_read_status',
    'player_profile_change_requests',
    'tournaments',
    'tournament_players',
    'financial_transactions',
    'buyin_requests',
    'buyout_requests',
    'fnb_orders',
    'players',
    'staff',
    'tables',
    'waitlist_entries',
    'transactions',
    'staff_offers',
    'offer_banners',
    'ads_offers',
    'gre_chat_messages',
    'gre_chat_sessions',
    'gre_online_status'
  ];
BEGIN
  FOREACH t IN ARRAY realtime_tables
  LOOP
    -- Skip tables that are not present in this DB.
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = t
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

      -- Compatibility realtime read policies
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_anon_realtime_select', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)', t || '_anon_realtime_select', t);

      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_authenticated_realtime_select', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || '_authenticated_realtime_select', t);

      -- Service role full access
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service_role_all', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t || '_service_role_all', t);
    END IF;
  END LOOP;
END $$;

-- Optional: verify generated policies for these tables
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'credit_requests',
    'leave_applications',
    'chat_messages',
    'chat_sessions',
    'push_notifications',
    'notification_read_status',
    'player_profile_change_requests',
    'tournaments',
    'tournament_players',
    'financial_transactions',
    'buyin_requests',
    'buyout_requests',
    'fnb_orders',
    'players',
    'staff',
    'tables',
    'waitlist_entries',
    'transactions',
    'staff_offers',
    'offer_banners',
    'ads_offers',
    'gre_chat_messages',
    'gre_chat_sessions',
    'gre_online_status'
  )
ORDER BY tablename, policyname;
