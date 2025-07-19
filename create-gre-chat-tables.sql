-- GRE Chat System Tables for Guest Relation Executive Portal Integration
-- Execute this script in your Supabase SQL Editor

-- Create GRE Chat Messages Table
CREATE TABLE IF NOT EXISTS gre_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL,
  gre_id UUID,
  message TEXT NOT NULL,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('player', 'gre')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Create GRE Online Status Table
CREATE TABLE IF NOT EXISTS gre_online_status (
  gre_id UUID PRIMARY KEY,
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'general',
  is_read BOOLEAN DEFAULT FALSE,
  action_url VARCHAR(500),
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Create Credit Requests Table (Fixed UUID issue)
CREATE TABLE IF NOT EXISTS credit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('credit_increase', 'emergency_credit')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  documents JSONB,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_gre_chat_messages_player_id ON gre_chat_messages(player_id);
CREATE INDEX IF NOT EXISTS idx_gre_chat_messages_timestamp ON gre_chat_messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gre_chat_sessions_player_id ON gre_chat_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_gre_chat_sessions_status ON gre_chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_push_notifications_player_id ON push_notifications(player_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_is_read ON push_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_credit_requests_player_id ON credit_requests(player_id);
CREATE INDEX IF NOT EXISTS idx_credit_requests_status ON credit_requests(status);

-- Insert sample GRE agents
INSERT INTO gre_online_status (gre_id, gre_name, is_online, status) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Sarah Johnson', true, 'available'),
  ('550e8400-e29b-41d4-a716-446655440001', 'Mike Chen', true, 'available'),
  ('550e8400-e29b-41d4-a716-446655440002', 'Emily Rodriguez', false, 'offline')
ON CONFLICT (gre_id) DO NOTHING;

-- Add RLS (Row Level Security) policies if needed
ALTER TABLE gre_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE gre_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view their own chat messages" ON gre_chat_messages
  FOR SELECT USING (auth.uid()::text IN (
    SELECT auth.users.id::text FROM auth.users 
    JOIN players ON players.email = auth.users.email 
    WHERE players.id = gre_chat_messages.player_id
  ));

CREATE POLICY "Users can insert their own chat messages" ON gre_chat_messages
  FOR INSERT WITH CHECK (auth.uid()::text IN (
    SELECT auth.users.id::text FROM auth.users 
    JOIN players ON players.email = auth.users.email 
    WHERE players.id = gre_chat_messages.player_id
  ));

-- Grant necessary permissions
GRANT ALL ON gre_chat_messages TO authenticated;
GRANT ALL ON gre_chat_sessions TO authenticated;
GRANT ALL ON gre_online_status TO authenticated;
GRANT ALL ON push_notifications TO authenticated;
GRANT ALL ON credit_requests TO authenticated;

-- Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE gre_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE gre_chat_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE gre_online_status;
ALTER PUBLICATION supabase_realtime ADD TABLE push_notifications;