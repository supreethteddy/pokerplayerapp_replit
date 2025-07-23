const { createClient } = require('@supabase/supabase-js');

const STAFF_PORTAL_SUPABASE_URL = process.env.STAFF_PORTAL_SUPABASE_URL || 'https://oyhnpnymlezjusnwpjeu.supabase.co';
const STAFF_PORTAL_SUPABASE_SERVICE_KEY = process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY;

if (!STAFF_PORTAL_SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing STAFF_PORTAL_SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const staffPortalSupabase = createClient(STAFF_PORTAL_SUPABASE_URL, STAFF_PORTAL_SUPABASE_SERVICE_KEY);

async function inspectDatabase() {
  console.log('🔍 [DATABASE INSPECTION] Checking Staff Portal Supabase structure...');
  console.log(`📡 [CONNECTION] Using: ${STAFF_PORTAL_SUPABASE_URL}`);

  try {
    // Check what tables are available by trying known table names
    const tablesToCheck = [
      'unified_chat_requests',
      'gre_chat_messages', 
      'gre_chat_requests',
      'chat_requests',
      'player_messages',
      'support_requests',
      'staff_messages',
      'players',
      'tables',
      'staff_tables'
    ];

    console.log('\n📋 [TABLE CHECK] Testing table existence...');
    
    for (const table of tablesToCheck) {
      try {
        const { data, error } = await staffPortalSupabase
          .from(table)
          .select('count(*)')
          .limit(1);
          
        if (!error && data) {
          console.log(`✅ [FOUND] ${table} - ${data[0]?.count || 0} records`);
          
          // Get a sample record to understand structure
          const { data: sample, error: sampleError } = await staffPortalSupabase
            .from(table)
            .select('*')
            .limit(1);
            
          if (!sampleError && sample && sample.length > 0) {
            console.log(`   Sample columns: ${Object.keys(sample[0]).join(', ')}`);
          }
        } else {
          console.log(`❌ [MISSING] ${table}`);
        }
      } catch (err) {
        console.log(`❌ [ERROR] ${table} - ${err.message}`);
      }
    }

    // Try to find any chat-related tables by pattern
    console.log('\n🔍 [SCHEMA SEARCH] Looking for chat-related tables...');
    
    // Since we can't query the schema directly, let's try some educated guesses
    const chatPatterns = [
      'chat',
      'message',
      'request',
      'ticket',
      'support',
      'help',
      'gre'
    ];

    for (const pattern of chatPatterns) {
      const possibleTables = [
        `${pattern}s`,
        `${pattern}_requests`,
        `${pattern}_messages`,
        `staff_${pattern}`,
        `player_${pattern}`,
        `unified_${pattern}`
      ];
      
      for (const tableName of possibleTables) {
        try {
          const { data, error } = await staffPortalSupabase
            .from(tableName)
            .select('count(*)')
            .limit(1);
            
          if (!error) {
            console.log(`✅ [PATTERN MATCH] Found: ${tableName} with ${data[0]?.count || 0} records`);
          }
        } catch (err) {
          // Silent fail for pattern matching
        }
      }
    }

    // Check existing gre_chat_messages structure (we know this exists)
    console.log('\n📊 [GRE ANALYSIS] Analyzing existing gre_chat_messages table...');
    
    try {
      const { data: greMessages, error: greError } = await staffPortalSupabase
        .from('gre_chat_messages')
        .select('*')
        .limit(3);
        
      if (!greError && greMessages) {
        console.log(`✅ [GRE MESSAGES] Found ${greMessages.length} messages`);
        if (greMessages.length > 0) {
          console.log('   Structure:', Object.keys(greMessages[0]));
          console.log('   Sample:', greMessages[0]);
        }
      }
    } catch (err) {
      console.log('❌ [GRE ERROR]', err.message);
    }

    console.log('\n🎯 [RECOMMENDATION] Based on inspection:');
    console.log('   The Staff Portal has cleared their unified system.');
    console.log('   We should adapt to use existing gre_chat_messages table');
    console.log('   or create a new unified_chat_requests table manually.');

  } catch (error) {
    console.error('❌ [INSPECTION ERROR]', error);
  }
}

inspectDatabase();