import { createClient } from '@supabase/supabase-js';

const staffPortalSupabase = createClient(
  process.env.STAFF_PORTAL_SUPABASE_URL!,
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY!
);

async function testStaffPortalConnection() {
  console.log('🔍 [STAFF PORTAL TEST] Testing Staff Portal Supabase connection...');
  console.log('🔗 [STAFF PORTAL TEST] URL:', process.env.STAFF_PORTAL_SUPABASE_URL);
  console.log('🔑 [STAFF PORTAL TEST] Service key exists:', !!process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY);
  
  try {
    // Test connection and get tables
    const { data: tables, error, count } = await staffPortalSupabase
      .from('tables')
      .select('*', { count: 'exact' });

    if (error) {
      console.error('❌ [STAFF PORTAL TEST] Error fetching tables:', error);
      return;
    }

    console.log(`📊 [STAFF PORTAL TEST] Found ${count} tables in Staff Portal database`);
    
    if (tables && tables.length > 0) {
      console.log('📋 [STAFF PORTAL TEST] Table details:');
      tables.forEach((table, index) => {
        console.log(`  ${index + 1}. ID: ${table.id}, Name: ${table.name}, Type: ${table.game_type || 'N/A'}`);
      });
    } else {
      console.log('📋 [STAFF PORTAL TEST] No tables found in Staff Portal database');
    }

    // Test other related tables
    const { data: players, error: playersError } = await staffPortalSupabase
      .from('players')
      .select('*', { count: 'exact', head: true });

    if (!playersError) {
      console.log(`👥 [STAFF PORTAL TEST] Found ${players} players in Staff Portal database`);
    }

    return { success: true, tableCount: count, tables };

  } catch (error) {
    console.error('❌ [STAFF PORTAL TEST] Connection error:', error);
    return { success: false, error };
  }
}

// Run the test
testStaffPortalConnection().then(result => {
  console.log('🎯 [STAFF PORTAL TEST] Result:', result);
  process.exit(0);
}).catch(error => {
  console.error('💥 [STAFF PORTAL TEST] Fatal error:', error);
  process.exit(1);
});