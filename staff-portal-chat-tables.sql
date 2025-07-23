
-- CRITICAL: Staff Portal Unified Chat System Tables
-- Execute this SQL in your Staff Portal Supabase database

-- 1. Create gre_chat_messages table (existing system)
CREATE TABLE IF NOT EXISTS gre_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    message TEXT NOT NULL,
    sender TEXT DEFAULT 'player' CHECK (sender IN ('player', 'gre', 'staff')),
    sender_name TEXT NOT NULL,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'read', 'replied')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create unified_chat_requests table (new unified system)
CREATE TABLE IF NOT EXISTS unified_chat_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    player_email TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    source TEXT DEFAULT 'poker_room_tracker',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed')),
    resolution_note TEXT,
    resolved_by TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gre_chat_player_id ON gre_chat_messages(player_id);
CREATE INDEX IF NOT EXISTS idx_gre_chat_created_at ON gre_chat_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_unified_chat_player_id ON unified_chat_requests(player_id);
CREATE INDEX IF NOT EXISTS idx_unified_chat_status ON unified_chat_requests(status);
CREATE INDEX IF NOT EXISTS idx_unified_chat_priority ON unified_chat_requests(priority);
CREATE INDEX IF NOT EXISTS idx_unified_chat_created_at ON unified_chat_requests(created_at);

-- 4. Insert test messages to verify functionality
INSERT INTO gre_chat_messages (player_id, player_name, message, sender, sender_name, status) VALUES
(29, 'Vignesh Gana', 'GRE CHAT SYSTEM: Table created and ready for Player Portal integration', 'player', 'Vignesh Gana', 'sent');

INSERT INTO unified_chat_requests (player_id, player_name, player_email, message, priority, source, status) VALUES
(29, 'Vignesh Gana', 'vignesh.wildleaf@gmail.com', 'UNIFIED CHAT SYSTEM: Table created and ready for Staff Portal integration', 'urgent', 'poker_room_tracker', 'pending');

-- 5. Verify table creation
SELECT 'gre_chat_messages' as table_name, COUNT(*) as record_count FROM gre_chat_messages
UNION ALL
SELECT 'unified_chat_requests' as table_name, COUNT(*) as record_count FROM unified_chat_requests;
