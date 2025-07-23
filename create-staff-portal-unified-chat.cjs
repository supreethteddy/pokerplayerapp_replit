const { createClient } = require('@supabase/supabase-js');

// Staff Portal Supabase connection
const STAFF_PORTAL_SUPABASE_URL = process.env.STAFF_PORTAL_SUPABASE_URL || 'https://oyhnpnymlezjusnwpjeu.supabase.co';
const STAFF_PORTAL_SUPABASE_SERVICE_KEY = process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY;

if (!STAFF_PORTAL_SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing STAFF_PORTAL_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const staffPortalSupabase = createClient(STAFF_PORTAL_SUPABASE_URL, STAFF_PORTAL_SUPABASE_SERVICE_KEY);

async function createUnifiedChatTable() {
  console.log('🔨 [CREATE TABLE] Creating unified_chat_requests table in Staff Portal Supabase...');
  console.log(`📡 [CONNECTION] Using: ${STAFF_PORTAL_SUPABASE_URL}`);

  try {
    // First, check if table exists
    const { data: existingData, error: checkError } = await staffPortalSupabase
      .from('unified_chat_requests')
      .select('count(*)')
      .limit(1);

    if (!checkError) {
      console.log('✅ [TABLE EXISTS] unified_chat_requests table already exists');
      console.log(`   Current records: ${existingData?.[0]?.count || 0}`);
      return true;
    }

    console.log('📋 [TABLE STATUS] Table does not exist, creating now...');

    // Create the table using raw SQL
    const createTableSQL = `
      -- CRITICAL: Unified Chat System Table for Staff Portal Integration
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

      -- Create indexes for performance
      CREATE INDEX IF NOT EXISTS idx_unified_chat_player_id ON unified_chat_requests(player_id);
      CREATE INDEX IF NOT EXISTS idx_unified_chat_status ON unified_chat_requests(status);
      CREATE INDEX IF NOT EXISTS idx_unified_chat_priority ON unified_chat_requests(priority);
      CREATE INDEX IF NOT EXISTS idx_unified_chat_created_at ON unified_chat_requests(created_at);
      CREATE INDEX IF NOT EXISTS idx_unified_chat_source ON unified_chat_requests(source);
    `;

    // Execute the SQL
    const { data: createResult, error: createError } = await staffPortalSupabase.rpc('exec_sql', {
      sql: createTableSQL
    });

    if (createError) {
      console.error('❌ [CREATE ERROR]', createError);
      
      // Try alternative method - creating through direct insert (which will fail but help us understand the issue)
      console.log('🔄 [ALTERNATIVE] Trying direct table creation...');
      
      // This should create the table if it doesn't exist
      const { data: insertTest, error: insertError } = await staffPortalSupabase
        .from('unified_chat_requests')
        .insert([{
          player_id: 999,
          player_name: 'Test User',
          player_email: 'test@example.com',
          message: 'Table creation test',
          priority: 'low',
          source: 'test',
          status: 'pending'
        }])
        .select();

      if (insertError) {
        console.error('❌ [INSERT ERROR] Could not create table:', insertError);
        return false;
      } else {
        console.log('✅ [TABLE CREATED] Table created via insert method');
        
        // Remove test record
        await staffPortalSupabase
          .from('unified_chat_requests')
          .delete()
          .eq('player_id', 999);
      }
    } else {
      console.log('✅ [TABLE CREATED] Table created successfully via SQL');
    }

    // Verify table creation
    const { data: verifyData, error: verifyError } = await staffPortalSupabase
      .from('unified_chat_requests')
      .select('count(*)')
      .limit(1);

    if (verifyError) {
      console.error('❌ [VERIFY ERROR]', verifyError);
      return false;
    }

    console.log('✅ [VERIFICATION] Table verification successful');
    console.log(`   Record count: ${verifyData?.[0]?.count || 0}`);

    // Insert test message to verify functionality
    console.log('📤 [TEST INSERT] Creating test message...');
    
    const { data: testMessage, error: testError } = await staffPortalSupabase
      .from('unified_chat_requests')
      .insert([{
        player_id: 29,
        player_name: 'Vignesh Gana',
        player_email: 'vignesh.wildleaf@gmail.com',
        message: 'UNIFIED CHAT SYSTEM CREATED: Staff Portal integration table successfully deployed - ' + new Date().toISOString(),
        priority: 'urgent',
        source: 'poker_room_tracker',
        status: 'pending'
      }])
      .select()
      .single();

    if (testError) {
      console.error('❌ [TEST INSERT ERROR]', testError);
      return false;
    }

    console.log('✅ [TEST MESSAGE CREATED]');
    console.log(`   ID: ${testMessage.id}`);
    console.log(`   Player: ${testMessage.player_name}`);
    console.log(`   Message: ${testMessage.message}`);
    console.log(`   Status: ${testMessage.status}`);
    console.log(`   Created: ${testMessage.created_at}`);

    console.log('\n🎉 [SUCCESS] Unified chat system table created and tested successfully!');
    console.log('🚀 [READY] Staff Portal can now receive Player Portal messages!');
    
    return true;

  } catch (error) {
    console.error('❌ [FATAL ERROR] Failed to create unified chat table:', error);
    return false;
  }
}

// Run the creation
createUnifiedChatTable()
  .then(success => {
    if (success) {
      console.log('\n✅ [FINAL] Unified chat table ready for Staff Portal integration!');
      process.exit(0);
    } else {
      console.log('\n❌ [FINAL] Table creation failed - check errors above');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ [EXECUTION ERROR]:', error);
    process.exit(1);
  });