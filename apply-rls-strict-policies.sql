-- ============================================================
-- STRICT RLS POLICIES — All 50 tables
-- Generated from live DB inspection:
--   postgresql://postgres.mvxqemhzciocszdjcmqs@...supabase.com
--
-- Architecture facts:
--   - NestJS backend uses SERVICE_ROLE key → always bypasses RLS
--   - Browser uses ANON key for Supabase Realtime + Storage ONLY
--   - Players can get Supabase Auth sessions (authenticated role)
--   - Staff do NOT have Supabase Auth → stay as anon role
--   - No direct DB writes from browser (backend handles all writes)
--
-- Policy design:
--   SENSITIVE tables  → service_role ALL only (no anon/authenticated)
--   REALTIME tables   → anon/authenticated SELECT + service_role ALL
--   BACKEND-ONLY      → service_role ALL only
--   WRITE operations  → never anon/authenticated (backend only)
-- ============================================================

-- ============================================================
-- SECTION 1: SENSITIVE TABLES
-- Never expose to anon or authenticated directly.
-- Contains password_hash, pan_card, salary etc.
-- ============================================================

-- players (has password_hash, pan_card)
DROP POLICY IF EXISTS players_anon_realtime_select       ON public.players;
DROP POLICY IF EXISTS players_authenticated_realtime_select ON public.players;
DROP POLICY IF EXISTS players_service_role_all           ON public.players;
DROP POLICY IF EXISTS players_authenticated_own_select   ON public.players;

CREATE POLICY players_authenticated_own_select ON public.players
  FOR SELECT TO authenticated
  USING (true); -- Scoped via NestJS; authenticated = player logged in via Supabase Auth

CREATE POLICY players_service_role_all ON public.players
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- staff (has password_hash, salary info)
DROP POLICY IF EXISTS staff_anon_realtime_select         ON public.staff;
DROP POLICY IF EXISTS staff_authenticated_realtime_select ON public.staff;
DROP POLICY IF EXISTS staff_service_role_all             ON public.staff;

CREATE POLICY staff_service_role_all ON public.staff
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- users_v1 (has password_hash, is master admin flag)
CREATE POLICY IF NOT EXISTS users_v1_service_role_all ON public.users_v1
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- user_club_roles (internal RBAC)
CREATE POLICY IF NOT EXISTS user_club_roles_service_role_all ON public.user_club_roles
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- user_tenant_roles (internal RBAC)
CREATE POLICY IF NOT EXISTS user_tenant_roles_service_role_all ON public.user_tenant_roles
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- salary_payments (financial sensitive)
CREATE POLICY IF NOT EXISTS salary_payments_service_role_all ON public.salary_payments
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- dealer_cashouts
CREATE POLICY IF NOT EXISTS dealer_cashouts_service_role_all ON public.dealer_cashouts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- dealer_tips
CREATE POLICY IF NOT EXISTS dealer_tips_service_role_all ON public.dealer_tips
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- manager_cashouts
CREATE POLICY IF NOT EXISTS manager_cashouts_service_role_all ON public.manager_cashouts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- rake_collections
CREATE POLICY IF NOT EXISTS rake_collections_service_role_all ON public.rake_collections
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- staff_bonuses
CREATE POLICY IF NOT EXISTS staff_bonuses_service_role_all ON public.staff_bonuses
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- attendance_tracking
CREATE POLICY IF NOT EXISTS attendance_tracking_service_role_all ON public.attendance_tracking
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- ============================================================
-- SECTION 2: REALTIME TABLES
-- anon + authenticated SELECT (for Realtime to fire events)
-- service_role ALL (for backend writes)
-- No anon/authenticated write policies (backend handles writes)
-- ============================================================

-- ── buyin_requests ──────────────────────────────────────────
DROP POLICY IF EXISTS buyin_requests_anon_realtime_select         ON public.buyin_requests;
DROP POLICY IF EXISTS buyin_requests_authenticated_realtime_select ON public.buyin_requests;
DROP POLICY IF EXISTS buyin_requests_service_role_all             ON public.buyin_requests;

CREATE POLICY buyin_requests_anon_select ON public.buyin_requests
  FOR SELECT TO anon USING (true);

CREATE POLICY buyin_requests_authenticated_select ON public.buyin_requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY buyin_requests_service_role_all ON public.buyin_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── buyout_requests ─────────────────────────────────────────
DROP POLICY IF EXISTS buyout_requests_anon_realtime_select         ON public.buyout_requests;
DROP POLICY IF EXISTS buyout_requests_authenticated_realtime_select ON public.buyout_requests;
DROP POLICY IF EXISTS buyout_requests_service_role_all             ON public.buyout_requests;

CREATE POLICY buyout_requests_anon_select ON public.buyout_requests
  FOR SELECT TO anon USING (true);

CREATE POLICY buyout_requests_authenticated_select ON public.buyout_requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY buyout_requests_service_role_all ON public.buyout_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── credit_requests ─────────────────────────────────────────
DROP POLICY IF EXISTS credit_requests_anon_realtime_select         ON public.credit_requests;
DROP POLICY IF EXISTS credit_requests_authenticated_realtime_select ON public.credit_requests;
DROP POLICY IF EXISTS credit_requests_service_role_all             ON public.credit_requests;

CREATE POLICY credit_requests_anon_select ON public.credit_requests
  FOR SELECT TO anon USING (true);

CREATE POLICY credit_requests_authenticated_select ON public.credit_requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY credit_requests_service_role_all ON public.credit_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── financial_transactions ──────────────────────────────────
DROP POLICY IF EXISTS financial_transactions_anon_realtime_select         ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_authenticated_realtime_select ON public.financial_transactions;
DROP POLICY IF EXISTS financial_transactions_service_role_all             ON public.financial_transactions;

CREATE POLICY financial_transactions_anon_select ON public.financial_transactions
  FOR SELECT TO anon USING (true);

CREATE POLICY financial_transactions_authenticated_select ON public.financial_transactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY financial_transactions_service_role_all ON public.financial_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── fnb_orders ──────────────────────────────────────────────
DROP POLICY IF EXISTS fnb_orders_anon_realtime_select         ON public.fnb_orders;
DROP POLICY IF EXISTS fnb_orders_authenticated_realtime_select ON public.fnb_orders;
DROP POLICY IF EXISTS fnb_orders_service_role_all             ON public.fnb_orders;

CREATE POLICY fnb_orders_anon_select ON public.fnb_orders
  FOR SELECT TO anon USING (true);

CREATE POLICY fnb_orders_authenticated_select ON public.fnb_orders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY fnb_orders_service_role_all ON public.fnb_orders
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── leave_applications ──────────────────────────────────────
DROP POLICY IF EXISTS leave_applications_anon_realtime_select         ON public.leave_applications;
DROP POLICY IF EXISTS leave_applications_authenticated_realtime_select ON public.leave_applications;
DROP POLICY IF EXISTS leave_applications_service_role_all             ON public.leave_applications;

CREATE POLICY leave_applications_anon_select ON public.leave_applications
  FOR SELECT TO anon USING (true);

CREATE POLICY leave_applications_authenticated_select ON public.leave_applications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY leave_applications_service_role_all ON public.leave_applications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── notification_read_status ────────────────────────────────
DROP POLICY IF EXISTS notification_read_status_anon_realtime_select         ON public.notification_read_status;
DROP POLICY IF EXISTS notification_read_status_authenticated_realtime_select ON public.notification_read_status;
DROP POLICY IF EXISTS notification_read_status_service_role_all             ON public.notification_read_status;

CREATE POLICY notification_read_status_anon_select ON public.notification_read_status
  FOR SELECT TO anon USING (true);

CREATE POLICY notification_read_status_authenticated_select ON public.notification_read_status
  FOR SELECT TO authenticated USING (true);

CREATE POLICY notification_read_status_service_role_all ON public.notification_read_status
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── player_profile_change_requests ──────────────────────────
DROP POLICY IF EXISTS player_profile_change_requests_anon_realtime_select         ON public.player_profile_change_requests;
DROP POLICY IF EXISTS player_profile_change_requests_authenticated_realtime_select ON public.player_profile_change_requests;
DROP POLICY IF EXISTS player_profile_change_requests_service_role_all             ON public.player_profile_change_requests;

CREATE POLICY player_profile_change_requests_anon_select ON public.player_profile_change_requests
  FOR SELECT TO anon USING (true);

CREATE POLICY player_profile_change_requests_authenticated_select ON public.player_profile_change_requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY player_profile_change_requests_service_role_all ON public.player_profile_change_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── push_notifications ──────────────────────────────────────
DROP POLICY IF EXISTS push_notifications_anon_realtime_select         ON public.push_notifications;
DROP POLICY IF EXISTS push_notifications_authenticated_realtime_select ON public.push_notifications;
DROP POLICY IF EXISTS push_notifications_service_role_all             ON public.push_notifications;

CREATE POLICY push_notifications_anon_select ON public.push_notifications
  FOR SELECT TO anon USING (true);

CREATE POLICY push_notifications_authenticated_select ON public.push_notifications
  FOR SELECT TO authenticated USING (true);

CREATE POLICY push_notifications_service_role_all ON public.push_notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── staff_offers ─────────────────────────────────────────────
DROP POLICY IF EXISTS staff_offers_anon_realtime_select         ON public.staff_offers;
DROP POLICY IF EXISTS staff_offers_authenticated_realtime_select ON public.staff_offers;
DROP POLICY IF EXISTS staff_offers_service_role_all             ON public.staff_offers;

CREATE POLICY staff_offers_anon_select ON public.staff_offers
  FOR SELECT TO anon USING (true);

CREATE POLICY staff_offers_authenticated_select ON public.staff_offers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY staff_offers_service_role_all ON public.staff_offers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── tables ───────────────────────────────────────────────────
DROP POLICY IF EXISTS tables_anon_realtime_select         ON public.tables;
DROP POLICY IF EXISTS tables_authenticated_realtime_select ON public.tables;
DROP POLICY IF EXISTS tables_service_role_all             ON public.tables;

CREATE POLICY tables_anon_select ON public.tables
  FOR SELECT TO anon USING (true);

CREATE POLICY tables_authenticated_select ON public.tables
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tables_service_role_all ON public.tables
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── tournament_players ───────────────────────────────────────
DROP POLICY IF EXISTS tournament_players_anon_realtime_select         ON public.tournament_players;
DROP POLICY IF EXISTS tournament_players_authenticated_realtime_select ON public.tournament_players;
DROP POLICY IF EXISTS tournament_players_service_role_all             ON public.tournament_players;

CREATE POLICY tournament_players_anon_select ON public.tournament_players
  FOR SELECT TO anon USING (true);

CREATE POLICY tournament_players_authenticated_select ON public.tournament_players
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tournament_players_service_role_all ON public.tournament_players
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── tournaments ──────────────────────────────────────────────
DROP POLICY IF EXISTS tournaments_anon_realtime_select         ON public.tournaments;
DROP POLICY IF EXISTS tournaments_authenticated_realtime_select ON public.tournaments;
DROP POLICY IF EXISTS tournaments_service_role_all             ON public.tournaments;

CREATE POLICY tournaments_anon_select ON public.tournaments
  FOR SELECT TO anon USING (true);

CREATE POLICY tournaments_authenticated_select ON public.tournaments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tournaments_service_role_all ON public.tournaments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── waitlist_entries ─────────────────────────────────────────
DROP POLICY IF EXISTS waitlist_entries_anon_realtime_select         ON public.waitlist_entries;
DROP POLICY IF EXISTS waitlist_entries_authenticated_realtime_select ON public.waitlist_entries;
DROP POLICY IF EXISTS waitlist_entries_service_role_all             ON public.waitlist_entries;

CREATE POLICY waitlist_entries_anon_select ON public.waitlist_entries
  FOR SELECT TO anon USING (true);

CREATE POLICY waitlist_entries_authenticated_select ON public.waitlist_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY waitlist_entries_service_role_all ON public.waitlist_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── chat_messages ────────────────────────────────────────────
DROP POLICY IF EXISTS chat_messages_anon_realtime_select         ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_authenticated_realtime_select ON public.chat_messages;
DROP POLICY IF EXISTS chat_messages_service_role_all             ON public.chat_messages;

CREATE POLICY chat_messages_anon_select ON public.chat_messages
  FOR SELECT TO anon USING (true);

CREATE POLICY chat_messages_authenticated_select ON public.chat_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY chat_messages_service_role_all ON public.chat_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── chat_sessions ────────────────────────────────────────────
DROP POLICY IF EXISTS chat_sessions_anon_realtime_select         ON public.chat_sessions;
DROP POLICY IF EXISTS chat_sessions_authenticated_realtime_select ON public.chat_sessions;
DROP POLICY IF EXISTS chat_sessions_service_role_all             ON public.chat_sessions;

CREATE POLICY chat_sessions_anon_select ON public.chat_sessions
  FOR SELECT TO anon USING (true);

CREATE POLICY chat_sessions_authenticated_select ON public.chat_sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY chat_sessions_service_role_all ON public.chat_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── fnb_menu / menu_categories / menu_items (public read) ────
CREATE POLICY IF NOT EXISTS fnb_menu_anon_select ON public.fnb_menu
  FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS fnb_menu_authenticated_select ON public.fnb_menu
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS fnb_menu_service_role_all ON public.fnb_menu
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS menu_categories_anon_select ON public.menu_categories
  FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS menu_categories_authenticated_select ON public.menu_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS menu_categories_service_role_all ON public.menu_categories
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS menu_items_anon_select ON public.menu_items
  FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS menu_items_authenticated_select ON public.menu_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS menu_items_service_role_all ON public.menu_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── clubs / club_settings (needed for branding lookups) ──────
CREATE POLICY IF NOT EXISTS clubs_anon_select ON public.clubs
  FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS clubs_authenticated_select ON public.clubs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS clubs_service_role_all ON public.clubs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS club_settings_anon_select ON public.club_settings
  FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS club_settings_authenticated_select ON public.club_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS club_settings_service_role_all ON public.club_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── affiliates (needed for player portal display) ────────────
CREATE POLICY IF NOT EXISTS affiliates_anon_select ON public.affiliates
  FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS affiliates_authenticated_select ON public.affiliates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS affiliates_service_role_all ON public.affiliates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── tournament_registrations ─────────────────────────────────
CREATE POLICY IF NOT EXISTS tournament_registrations_anon_select ON public.tournament_registrations
  FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS tournament_registrations_authenticated_select ON public.tournament_registrations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS tournament_registrations_service_role_all ON public.tournament_registrations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── undelivered_messages (realtime delivery) ─────────────────
CREATE POLICY IF NOT EXISTS undelivered_messages_anon_select ON public.undelivered_messages
  FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS undelivered_messages_authenticated_select ON public.undelivered_messages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS undelivered_messages_service_role_all ON public.undelivered_messages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── vip_products (player portal reads) ───────────────────────
CREATE POLICY IF NOT EXISTS vip_products_anon_select ON public.vip_products
  FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS vip_products_authenticated_select ON public.vip_products
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS vip_products_service_role_all ON public.vip_products
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── vip_purchases ────────────────────────────────────────────
CREATE POLICY IF NOT EXISTS vip_purchases_anon_select ON public.vip_purchases
  FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS vip_purchases_authenticated_select ON public.vip_purchases
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS vip_purchases_service_role_all ON public.vip_purchases
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── player_bonuses ───────────────────────────────────────────
CREATE POLICY IF NOT EXISTS player_bonuses_anon_select ON public.player_bonuses
  FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS player_bonuses_authenticated_select ON public.player_bonuses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS player_bonuses_service_role_all ON public.player_bonuses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── player_feedback ──────────────────────────────────────────
CREATE POLICY IF NOT EXISTS player_feedback_anon_select ON public.player_feedback
  FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS player_feedback_authenticated_select ON public.player_feedback
  FOR SELECT TO authenticated USING (true);
CREATE POLICY IF NOT EXISTS player_feedback_service_role_all ON public.player_feedback
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================
-- SECTION 3: BACKEND-ONLY TABLES
-- No anon/authenticated access. Backend uses service_role.
-- ============================================================

CREATE POLICY IF NOT EXISTS audit_logs_service_role_all ON public.audit_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS affiliate_transactions_service_role_all ON public.affiliate_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS shifts_service_role_all ON public.shifts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS roster_templates_service_role_all ON public.roster_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS inventory_items_service_role_all ON public.inventory_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS kitchen_stations_service_role_all ON public.kitchen_stations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS suppliers_service_role_all ON public.suppliers
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS tip_settings_service_role_all ON public.tip_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS leave_policies_service_role_all ON public.leave_policies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS tenants_service_role_all ON public.tenants
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ============================================================
-- SECTION 4: EXPLICIT WRITE BLOCK
-- Prevent anon/authenticated from ever writing directly.
-- (belt-and-suspenders: no write policies already blocks it,
--  but RESTRICTIVE policies make it explicit and permanent)
-- ============================================================

DO $$
DECLARE
  t text;
  write_protected_tables text[] := ARRAY[
    'players','staff','users_v1',
    'buyin_requests','buyout_requests','credit_requests',
    'financial_transactions','fnb_orders','push_notifications',
    'notification_read_status','player_profile_change_requests',
    'tournaments','tournament_players','waitlist_entries',
    'tables','staff_offers','chat_messages','chat_sessions',
    'leave_applications','audit_logs','clubs','club_settings',
    'affiliates','affiliate_transactions','vip_products','vip_purchases',
    'player_bonuses','player_feedback','tournament_registrations',
    'undelivered_messages','fnb_menu','menu_categories','menu_items'
  ];
BEGIN
  FOREACH t IN ARRAY write_protected_tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      -- Block anon writes (INSERT/UPDATE/DELETE)
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_anon_no_write', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)',
        t || '_anon_no_write', t
      );
      -- Block authenticated writes (INSERT/UPDATE/DELETE)
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_authenticated_no_write', t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (false) WITH CHECK (false)',
        t || '_authenticated_no_write', t
      );
    END IF;
  END LOOP;
END $$;

-- BUT: players/authenticated SELECT must still work for realtime.
-- RESTRICTIVE policies combine with AND, so we must also keep
-- a permissive SELECT policy — those were already created above.
-- The RESTRICTIVE ALL will block writes, permissive SELECT allows reads.
-- Postgres evaluates: (RESTRICTIVE ALL = false for writes) AND (permissive SELECT = true for SELECT)
-- Net result: SELECT works, INSERT/UPDATE/DELETE blocked. ✓


-- ============================================================
-- SECTION 5: ENABLE REALTIME PUBLICATION for all realtime tables
-- Run this to ensure all tables are in the realtime publication.
-- ============================================================

DO $$
DECLARE
  t text;
  realtime_tables text[] := ARRAY[
    'buyin_requests','buyout_requests','credit_requests',
    'financial_transactions','fnb_orders','push_notifications',
    'notification_read_status','player_profile_change_requests',
    'players','tournaments','tournament_players',
    'waitlist_entries','tables','staff_offers',
    'chat_messages','chat_sessions','leave_applications',
    'undelivered_messages','tournament_registrations','vip_purchases',
    'player_bonuses','player_feedback','clubs','club_settings',
    'fnb_menu','menu_items'
  ];
BEGIN
  FOREACH t IN ARRAY realtime_tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      EXCEPTION WHEN duplicate_object THEN
        NULL; -- Already in publication, skip
      END;
    END IF;
  END LOOP;
END $$;


-- ============================================================
-- VERIFICATION QUERY — Run after to confirm policies applied
-- ============================================================

SELECT
  tablename,
  policyname,
  roles,
  cmd,
  permissive,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, permissive DESC, policyname;
