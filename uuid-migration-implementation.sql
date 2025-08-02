-- 🚀 Cross-Portal Chat: UUID Migration Implementation
-- This script migrates the chat system to use UUIDs instead of integer player_ids

-- Step 1: Create UUID-based chat tables with new schema
CREATE TABLE IF NOT EXISTS gre_chat_sessions_uuid (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL, -- This will be Supabase auth.users.id
  gre_id UUID, -- Staff member UUID
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  category VARCHAR(50) DEFAULT 'support',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gre_chat_messages_uuid (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES gre_chat_sessions_uuid(id) ON DELETE CASCADE,
  player_id UUID NOT NULL, -- This will be Supabase auth.users.id
  player_name VARCHAR(100),
  message TEXT NOT NULL,
  sender VARCHAR(10) NOT NULL CHECK (sender IN ('player', 'gre')),
  sender_name VARCHAR(100),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  request_id UUID
);

CREATE TABLE IF NOT EXISTS chat_requests_uuid (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL, -- This will be Supabase auth.users.id
  player_name VARCHAR(100) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(10) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  category VARCHAR(50) DEFAULT 'support',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by VARCHAR(100),
  notes TEXT
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gre_chat_sessions_uuid_player_id ON gre_chat_sessions_uuid(player_id);
CREATE INDEX IF NOT EXISTS idx_gre_chat_sessions_uuid_status ON gre_chat_sessions_uuid(status);
CREATE INDEX IF NOT EXISTS idx_gre_chat_messages_uuid_player_id ON gre_chat_messages_uuid(player_id);
CREATE INDEX IF NOT EXISTS idx_gre_chat_messages_uuid_session_id ON gre_chat_messages_uuid(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_requests_uuid_player_id ON chat_requests_uuid(player_id);
CREATE INDEX IF NOT EXISTS idx_chat_requests_uuid_status ON chat_requests_uuid(status);

-- Step 3: Create a test UUID for migration (simulating a Supabase auth.users.id)
-- This represents the current player (ID 29) with a proper UUID
INSERT INTO gre_chat_sessions_uuid (
  id, player_id, gre_id, status, started_at, priority, category, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'e0953527-a5d5-402c-9e00-8ed590d19cde', -- This is the Supabase Auth UUID for the current user
  null,
  'active',
  NOW(),
  'normal',
  'support',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Step 4: Migrate existing messages to UUID system
-- Since we have 15 messages in the system, let's migrate them with proper UUIDs
INSERT INTO gre_chat_messages_uuid (
  id, session_id, player_id, player_name, message, sender, sender_name, timestamp, status, created_at, updated_at
) 
SELECT 
  gen_random_uuid(),
  (SELECT id FROM gre_chat_sessions_uuid WHERE player_id = 'e0953527-a5d5-402c-9e00-8ed590d19cde' LIMIT 1),
  'e0953527-a5d5-402c-9e00-8ed590d19cde',
  player_name,
  message,
  sender,
  sender_name,
  timestamp,
  status,
  created_at,
  updated_at
FROM gre_chat_messages 
WHERE player_id = 29
ON CONFLICT DO NOTHING;

-- Step 5: Create a test chat request with UUID
INSERT INTO chat_requests_uuid (
  id, player_id, player_name, subject, message, status, priority, category, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'e0953527-a5d5-402c-9e00-8ed590d19cde',
  'Vignesh Gana',
  'UUID Migration Test - Staff Portal GRE integration',
  'Testing the new UUID-based chat system for cross-portal integration',
  'waiting',
  'normal',
  'support',
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Step 6: Verify the migration
SELECT 'UUID Migration Summary' as status;
SELECT 'Sessions' as table_name, COUNT(*) as records FROM gre_chat_sessions_uuid;
SELECT 'Messages' as table_name, COUNT(*) as records FROM gre_chat_messages_uuid;
SELECT 'Requests' as table_name, COUNT(*) as records FROM chat_requests_uuid;