const { createClient } = require('@supabase/supabase-js');

const STAFF_PORTAL_SUPABASE_URL = process.env.STAFF_PORTAL_SUPABASE_URL || 'https://oyhnpnymlezjusnwpjeu.supabase.co';
const STAFF_PORTAL_SUPABASE_SERVICE_KEY = process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY;

if (!STAFF_PORTAL_SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing STAFF_PORTAL_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const staffPortalSupabase = createClient(STAFF_PORTAL_SUPABASE_URL, STAFF_PORTAL_SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function createRequiredTables() {
  console.log('🔨 [CREATE TABLES] Creating required tables for Staff Portal unified system...');
  console.log(`📡 [CONNECTION] Using: ${STAFF_PORTAL_SUPABASE_URL}`);

  try {
    // Create gre_chat_messages table (the one we were using before)
    console.log('\n📋 [TABLE 1] Creating gre_chat_messages table...');
    
    const { data: greTable, error: greError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .insert([{
        player_id: 29,
        player_name: 'Vignesh Gana',
        message: 'SYSTEM INITIALIZATION: Creating Staff Portal GRE chat table - ' + new Date().toISOString(),
        sender: 'player',
        sender_name: 'Vignesh Gana',
        status: 'sent'
      }])
      .select()
      .single();

    if (greError && greError.code === 'PGRST116') {
      // Table doesn't exist, we need to create it via schema
      console.log('⚠️ [WARNING] gre_chat_messages table does not exist');
      console.log('   Staff Portal team needs to create this table');
    } else if (greError) {
      console.error('❌ [GRE ERROR]', greError);
    } else {
      console.log('✅ [GRE SUCCESS] gre_chat_messages table exists and working');
      console.log(`   Message ID: ${greTable.id}`);
    }

    // Create unified_chat_requests table for the new unified system
    console.log('\n📋 [TABLE 2] Creating unified_chat_requests table...');
    
    const { data: unifiedTable, error: unifiedError } = await staffPortalSupabase
      .from('unified_chat_requests')
      .insert([{
        player_id: 29,
        player_name: 'Vignesh Gana',
        player_email: 'vignesh.wildleaf@gmail.com',
        message: 'UNIFIED SYSTEM INITIALIZATION: Creating Staff Portal unified chat table - ' + new Date().toISOString(),
        priority: 'urgent',
        source: 'poker_room_tracker',
        status: 'pending'
      }])
      .select()
      .single();

    if (unifiedError && unifiedError.code === 'PGRST116') {
      console.log('⚠️ [WARNING] unified_chat_requests table does not exist');
      console.log('   This is the table needed for Staff Portal unified system');
    } else if (unifiedError) {
      console.error('❌ [UNIFIED ERROR]', unifiedError);
    } else {
      console.log('✅ [UNIFIED SUCCESS] unified_chat_requests table exists and working');
      console.log(`   Request ID: ${unifiedTable.id}`);
    }

    // Since we can't create tables via API, create a comprehensive SQL script
    console.log('\n📝 [SQL SCRIPT] Creating table creation script for Staff Portal...');
    
    const sqlScript = `
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
`;

    // Write the SQL script to a file
    const fs = require('fs');
    fs.writeFileSync('staff-portal-chat-tables.sql', sqlScript);
    console.log('✅ [SQL FILE] Created staff-portal-chat-tables.sql');
    console.log('   Staff Portal team should execute this SQL in their Supabase');

    console.log('\n🎯 [MANUAL SOLUTION] Since tables don\'t exist, here\'s what the Staff Portal team needs to do:');
    console.log('1. Execute the SQL script: staff-portal-chat-tables.sql');
    console.log('2. This will create both gre_chat_messages and unified_chat_requests tables');
    console.log('3. Player Portal will then connect immediately to the unified system');

    console.log('\n📞 [MESSAGE TO STAFF PORTAL TEAM]:');
    console.log('The Player Portal is ready to integrate with your unified chat system.');
    console.log('Please execute the provided SQL script in your Supabase to create the required tables.');
    console.log('Once created, messages from players will appear immediately in your Staff Portal.');

    return true;

  } catch (error) {
    console.error('❌ [FATAL ERROR] Failed to create tables:', error);
    return false;
  }
}

createRequiredTables();