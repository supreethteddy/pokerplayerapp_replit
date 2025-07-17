import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.STAFF_PORTAL_SUPABASE_URL!,
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY!
);

async function checkAllTables() {
  console.log('🔍 [TABLE CHECK] Checking all tables in Supabase database...');
  console.log('🔗 [TABLE CHECK] URL:', process.env.STAFF_PORTAL_SUPABASE_URL);
  
  try {
    // Method 1: Check if 'tables' table exists
    const { data: tablesData, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .limit(5);
    
    console.log('📋 [TABLE CHECK] Method 1 - Direct "tables" query:');
    console.log('  Error:', tablesError?.message || 'None');
    console.log('  Data count:', tablesData?.length || 0);
    if (tablesData && tablesData.length > 0) {
      console.log('  Sample data:', tablesData[0]);
    }
    
    // Method 2: Check different possible table names
    const possibleNames = ['poker_tables', 'game_tables', 'room_tables', 'table_list', 'gaming_tables'];
    
    for (const name of possibleNames) {
      try {
        const { data, error } = await supabase
          .from(name)
          .select('*')
          .limit(1);
        
        if (!error && data) {
          console.log(`✅ [TABLE CHECK] Found table: ${name} with ${data.length} records`);
        }
      } catch (e) {
        // Table doesn't exist, continue
      }
    }
    
    // Method 3: Use information_schema to get all tables
    const { data: allTables, error: schemaError } = await supabase
      .rpc('get_all_tables');
    
    if (!schemaError && allTables) {
      console.log('📊 [TABLE CHECK] All tables in database:', allTables);
    }
    
    // Method 4: Check with raw SQL
    const { data: rawTables, error: rawError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (!rawError && rawTables) {
      console.log('📋 [TABLE CHECK] Raw SQL table names:', rawTables.map(t => t.table_name));
    }
    
  } catch (error) {
    console.error('❌ [TABLE CHECK] Error:', error);
  }
}

checkAllTables().then(() => {
  console.log('✅ [TABLE CHECK] Complete');
  process.exit(0);
}).catch(error => {
  console.error('💥 [TABLE CHECK] Fatal error:', error);
  process.exit(1);
});