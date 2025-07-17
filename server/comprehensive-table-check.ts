import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function comprehensiveTableCheck() {
  console.log('🔍 [COMPREHENSIVE] Starting exhaustive table search...');
  
  try {
    // Method 1: Check all tables without any filters
    console.log('📋 [COMPREHENSIVE] Method 1: Standard table query');
    const { data: standardTables, error: standardError, count: standardCount } = await supabase
      .from('tables')
      .select('*', { count: 'exact' })
      .order('id', { ascending: true })
      .limit(10000); // Ensure we get ALL tables
    
    console.log(`📊 [COMPREHENSIVE] Standard query: ${standardCount} tables found`);
    if (standardTables) {
      console.log('🎯 [COMPREHENSIVE] IDs:', standardTables.map(t => t.id).join(', '));
    }
    
    // Method 2: Check for tables with different status
    console.log('📋 [COMPREHENSIVE] Method 2: Including inactive tables');
    const { data: allStatusTables, error: allStatusError } = await supabase
      .from('tables')
      .select('*')
      .is('is_active', null)
      .order('id', { ascending: true });
    
    console.log(`📊 [COMPREHENSIVE] All status tables: ${allStatusTables?.length || 0} found`);
    
    // Method 3: Raw SQL query to check for any hidden tables
    console.log('📋 [COMPREHENSIVE] Method 3: Raw SQL query');
    const { data: rawTables, error: rawError } = await supabase
      .rpc('get_all_tables_raw', {});
    
    if (rawError) {
      console.log('⚠️ [COMPREHENSIVE] Raw SQL not available, trying direct query');
      
      // Method 4: Check if there are multiple table schemas
      const { data: schemaTables, error: schemaError } = await supabase
        .from('information_schema.tables')
        .select('*')
        .eq('table_schema', 'public')
        .like('table_name', '%table%');
      
      console.log(`📊 [COMPREHENSIVE] Schema tables: ${schemaTables?.length || 0} found`);
    }
    
    // Method 5: Check for tables with specific name patterns from screenshot
    console.log('📋 [COMPREHENSIVE] Method 5: Pattern-based search');
    const patterns = ['Manager', 'Supabase', 'Staff', 'Action', 'Portal', 'Master', 'Cashier'];
    
    for (const pattern of patterns) {
      const { data: patternTables, error: patternError } = await supabase
        .from('tables')
        .select('*')
        .ilike('name', `%${pattern}%`);
      
      if (patternTables && patternTables.length > 0) {
        console.log(`🎯 [COMPREHENSIVE] Found ${patternTables.length} tables matching "${pattern}":`, patternTables.map(t => t.name).join(', '));
      }
    }
    
    // Method 6: Check for deleted or soft-deleted tables
    console.log('📋 [COMPREHENSIVE] Method 6: Checking for soft-deleted tables');
    const { data: deletedTables, error: deletedError } = await supabase
      .from('tables')
      .select('*')
      .eq('is_active', false);
    
    if (deletedTables && deletedTables.length > 0) {
      console.log(`🗑️ [COMPREHENSIVE] Found ${deletedTables.length} inactive tables:`, deletedTables.map(t => t.name).join(', '));
    }
    
    return {
      standardTables,
      allStatusTables,
      rawTables,
      totalFound: standardCount || 0
    };
    
  } catch (error) {
    console.error('❌ [COMPREHENSIVE] Error during comprehensive check:', error);
    return null;
  }
}

// Function to check if we're connected to the right database
export async function checkDatabaseConnection() {
  try {
    console.log('🔗 [DATABASE CHECK] Verifying database connection...');
    console.log('🔗 [DATABASE CHECK] Supabase URL:', process.env.VITE_SUPABASE_URL);
    console.log('🔗 [DATABASE CHECK] Service key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Get database metadata
    const { data: dbInfo, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(100);
    
    if (error) {
      console.error('❌ [DATABASE CHECK] Error getting database info:', error);
    } else {
      console.log('📊 [DATABASE CHECK] Public tables found:', dbInfo?.length || 0);
      console.log('📋 [DATABASE CHECK] Table names:', dbInfo?.map(t => t.table_name).join(', '));
    }
    
  } catch (error) {
    console.error('❌ [DATABASE CHECK] Connection check failed:', error);
  }
}