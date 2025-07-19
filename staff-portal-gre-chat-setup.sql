-- GRE Chat System Setup for Staff Portal Supabase Database
-- Execute this script in your Staff Portal Supabase SQL Editor

-- Create GRE Chat Sessions Table
CREATE TABLE IF NOT EXISTS gre_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL,
  gre_id UUID,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed', 'pending')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create GRE Chat Messages Table
CREATE TABLE IF NOT EXISTS gre_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES gre_chat_sessions(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL,
  player_name VARCHAR(255),
  message TEXT NOT NULL,
  sender VARCHAR(20) NOT NULL CHECK (sender IN ('player', 'gre')),
  sender_name VARCHAR(255),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  request_id INTEGER DEFAULT 0
);

-- Create GRE Online Status Table
CREATE TABLE IF NOT EXISTS gre_online_status (
  gre_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gre_name VARCHAR(100) NOT NULL,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  current_sessions INTEGER DEFAULT 0,
  max_sessions INTEGER DEFAULT 5,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'busy', 'away', 'offline')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Push Notifications Table
CREATE TABLE IF NOT EXISTS push_notifications (
  id SERIAL PRIMARY KEY,
  sender_id TEXT,
  sender_name TEXT,
  sender_role TEXT,
  target_player_id INTEGER,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'general',
  media_url TEXT,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'sent',
  broadcast_to_all BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gre_chat_sessions_player_id ON gre_chat_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_gre_chat_sessions_status ON gre_chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_gre_chat_messages_session_id ON gre_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_gre_chat_messages_player_id ON gre_chat_messages(player_id);
CREATE INDEX IF NOT EXISTS idx_gre_chat_messages_timestamp ON gre_chat_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gre_online_status_is_online ON gre_online_status(is_online);
CREATE INDEX IF NOT EXISTS idx_push_notifications_target_player_id ON push_notifications(target_player_id);

-- Insert demo GRE agents for testing
INSERT INTO gre_online_status (gre_id, gre_name, is_online, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Sarah Johnson', true, 'available'),
  ('550e8400-e29b-41d4-a716-446655440001', 'Mike Chen', true, 'available'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Emily Rodriguez', false, 'offline')
ON CONFLICT (gre_id) DO NOTHING;

-- Enable Row Level Security (RLS) for security
ALTER TABLE gre_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gre_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gre_online_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users
CREATE POLICY "Allow all operations for service role" ON gre_chat_sessions
  FOR ALL USING (true);

CREATE POLICY "Allow all operations for service role" ON gre_chat_messages
  FOR ALL USING (true);

CREATE POLICY "Allow all operations for service role" ON gre_online_status
  FOR ALL USING (true);

CREATE POLICY "Allow all operations for service role" ON push_notifications
  FOR ALL USING (true);

-- Grant permissions to authenticated role and service role
GRANT ALL ON gre_chat_sessions TO authenticated, service_role;
GRANT ALL ON gre_chat_messages TO authenticated, service_role;
GRANT ALL ON gre_online_status TO authenticated, service_role;
GRANT ALL ON push_notifications TO authenticated, service_role;

-- Grant usage on sequences
GRANT USAGE, SELECT ON SEQUENCE push_notifications_id_seq TO authenticated, service_role;

-- Enable real-time subscriptions for live chat functionality
ALTER PUBLICATION supabase_realtime ADD TABLE gre_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE gre_chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE gre_online_status;
ALTER PUBLICATION supabase_realtime ADD TABLE push_notifications;

-- Test the setup by creating a sample chat session for player 29
INSERT INTO gre_chat_sessions (player_id, status, category, priority) 
VALUES (29, 'active', 'general', 'normal')
ON CONFLICT DO NOTHING;

-- Verify the setup
SELECT 'Setup completed successfully!' as status, 
       (SELECT COUNT(*) FROM gre_chat_sessions) as chat_sessions,
       (SELECT COUNT(*) FROM gre_chat_messages) as chat_messages,
       (SELECT COUNT(*) FROM gre_online_status) as online_agents,
       (SELECT COUNT(*) FROM push_notifications) as notifications;