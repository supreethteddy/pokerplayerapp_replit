-- PURE SUPABASE+WEBSOCKET SYSTEM: CLEAN CHAT SETUP
-- This creates a completely clean GRE chat system using only Staff Portal Supabase

-- Ensure all chat tables are clean for authentic testing
TRUNCATE TABLE gre_chat_messages RESTART IDENTITY CASCADE;
TRUNCATE TABLE gre_chat_sessions RESTART IDENTITY CASCADE;

-- Reset sequences to start fresh
ALTER SEQUENCE IF EXISTS gre_chat_messages_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS gre_chat_sessions_id_seq RESTART WITH 1;

-- Verify clean state
SELECT 'gre_chat_messages' as table_name, COUNT(*) as record_count FROM gre_chat_messages
UNION ALL
SELECT 'gre_chat_sessions' as table_name, COUNT(*) as record_count FROM gre_chat_sessions;

-- READY FOR AUTHENTIC BIDIRECTIONAL TESTING
-- Next steps:
-- 1. Player sends message via Player Portal
-- 2. Message appears in Staff Portal GRE interface
-- 3. GRE responds via Staff Portal
-- 4. Response appears in Player Portal instantly
-- All data will be authentic with zero mock data contamination