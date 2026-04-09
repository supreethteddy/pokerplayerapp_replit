-- ============================================================
-- PUSH NOTIFICATION SYSTEM SETUP (FIXED & RESILIENT)
-- ============================================================

-- 1. Create device_tokens table (player_id is now NULLABLE)
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NULL, -- Made optional to avoid API failures
  token TEXT UNIQUE NOT NULL,
  platform TEXT, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure player_id can be null if it was created as NOT NULL previously
ALTER TABLE device_tokens ALTER COLUMN player_id DROP NOT NULL;

-- RLS for device_tokens
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable insert/update for all" ON device_tokens;
CREATE POLICY "Enable insert/update for all" ON device_tokens
  FOR ALL USING (true) WITH CHECK (true);

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_device_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_device_tokens_updated_at ON device_tokens;
CREATE TRIGGER trigger_update_device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_device_tokens_updated_at();

-- 2. Notification Trigger Function with EXCEPTION HANDLING
CREATE OR REPLACE FUNCTION notify_fcm()
RETURNS TRIGGER AS $$
DECLARE
  payload JSONB;
  notification_title TEXT;
  notification_body TEXT;
  target_player_id INTEGER := NULL;
  func_url TEXT;
  auth_header TEXT;
BEGIN
  -- Determine notification content based on table name
  IF (TG_TABLE_NAME = 'tournaments') THEN
    notification_title := '🏆 New Tournament!';
    notification_body := 'New tournament "' || COALESCE(NEW.name, 'Tournament') || '" has been added! Join now.';
    
  ELSIF (TG_TABLE_NAME = 'staff_offers') THEN
    notification_title := '🔥 New Special Offer!';
    notification_body := NEW.title;
    
  ELSIF (TG_TABLE_NAME = 'menu_items') THEN
    notification_title := '🍔 New Menu Item!';
    notification_body := 'Try our new ' || NEW.name || '! Check the Food & Beverage menu.';
    
  ELSIF (TG_TABLE_NAME = 'tables') THEN
    notification_title := '🃏 New Live Table!';
    notification_body := 'New ' || COALESCE(NEW.game_type, 'Poker') || ' table "' || NEW.name || '" is now live! Grab your seat.';
    
  ELSIF (TG_TABLE_NAME = 'unified_chat_requests') THEN
    -- Chat requests are the only ones that MUST have a player_id for targeted messaging
    target_player_id := NEW.player_id;
    
    IF (TG_OP = 'INSERT') THEN
      notification_title := '💬 New Message';
      notification_body := NEW.message;
    ELSIF (OLD.status != NEW.status AND NEW.status = 'resolved') THEN
      notification_title := '✅ Message Resolved';
      notification_body := 'Your request has been resolved: ' || COALESCE(NEW.resolution_note, 'No additional notes.');
    ELSE
      RETURN NEW;
    END IF;
    
  ELSE
    RETURN NEW;
  END IF;

  -- Construct payload
  payload := jsonb_build_object(
    'title', notification_title,
    'body', notification_body,
    'playerId', target_player_id
  );

  -- Log the attempt locally
  RAISE NOTICE 'Attempting FCM notification for %: %', TG_TABLE_NAME, payload;

  -- SAFELY CALL THE EDGE FUNCTION
  -- We wrap this in a BEGIN...EXCEPTION block so that if the notification system fails,
  -- YOUR MAIN DATABASE TRANSACTION (like creating a table) STILL SUCCEEDS.
  BEGIN
    -- Resolve URL dynamically with fallback
    -- Note: Ensure project ID is correct for your Supabase project
    func_url := 'https://vwzpqcycaovwvaovfsgg.supabase.co/functions/v1/send-notification';
    
    -- Try to get current auth header, fallback to no-auth if needed
    -- (The Edge Function should handle auth if it requires it, but we try to pass what we have)
    BEGIN
      auth_header := current_setting('request.headers')::json->>'authorization';
    EXCEPTION WHEN OTHERS THEN
      auth_header := NULL;
    END;

    PERFORM net.http_post(
      url := func_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', COALESCE(auth_header, '')
      ),
      body := payload
    );
  EXCEPTION WHEN OTHERS THEN
    -- SWALLOW ERRORS: If the notification call fails, we log it and move on.
    -- This prevents the 500 errors and allows core APIs to work properly.
    RAISE WARNING 'FCM notification failed for %: %. Error: %', TG_TABLE_NAME, payload, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Re-register Triggers
DROP TRIGGER IF EXISTS trigger_notify_tournament_created ON tournaments;
CREATE TRIGGER trigger_notify_tournament_created
  AFTER INSERT ON tournaments
  FOR EACH ROW
  EXECUTE FUNCTION notify_fcm();

DROP TRIGGER IF EXISTS trigger_notify_offer_created ON staff_offers;
CREATE TRIGGER trigger_notify_offer_created
  AFTER INSERT ON staff_offers
  FOR EACH ROW
  EXECUTE FUNCTION notify_fcm();

DROP TRIGGER IF EXISTS trigger_notify_fb_created ON menu_items;
CREATE TRIGGER trigger_notify_fb_created
  AFTER INSERT ON menu_items
  FOR EACH ROW
  EXECUTE FUNCTION notify_fcm();

DROP TRIGGER IF EXISTS trigger_notify_table_created ON tables;
CREATE TRIGGER trigger_notify_table_created
  AFTER INSERT ON tables
  FOR EACH ROW
  EXECUTE FUNCTION notify_fcm();

DROP TRIGGER IF EXISTS trigger_notify_chat_update ON unified_chat_requests;
CREATE TRIGGER trigger_notify_chat_update
  AFTER INSERT OR UPDATE ON unified_chat_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_fcm();
