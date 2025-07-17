import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function testDirectTableQuery() {
  console.log('🔍 [DIRECT TEST] Testing table query with service role key...');
  
  try {
    // Test 1: Basic count
    const { count: countResult, error: countError } = await supabase
      .from('tables')
      .select('*', { count: 'exact', head: true });
    
    console.log('📊 [DIRECT TEST] Count query result:', countResult);
    
    // Test 2: Get all tables with explicit service role
    const { data: allTables, error, count } = await supabase
      .from('tables')
      .select('*', { count: 'exact' })
      .limit(10000);
    
    console.log('📋 [DIRECT TEST] All tables query result:', {
      tablesReturned: allTables?.length || 0,
      totalCount: count,
      error: error?.message || null,
      allIds: allTables?.map(t => t.id) || []
    });
    
    // Test 3: Get tables with different ordering
    const { data: tablesAsc, error: errorAsc } = await supabase
      .from('tables')
      .select('*')
      .order('id', { ascending: true })
      .limit(10000);
    
    console.log('📋 [DIRECT TEST] Ascending order query result:', {
      tablesReturned: tablesAsc?.length || 0,
      allIds: tablesAsc?.map(t => t.id) || []
    });
    
    // Test 4: Check for any RLS policies
    const { data: policiesData, error: policiesError } = await supabase
      .rpc('get_policies', { table_name: 'tables' })
      .single();
    
    if (policiesError) {
      console.log('⚠️ [DIRECT TEST] Could not check RLS policies:', policiesError.message);
    } else {
      console.log('🔐 [DIRECT TEST] RLS policies:', policiesData);
    }
    
    return {
      countResult,
      totalTables: allTables?.length || 0,
      allIds: allTables?.map(t => t.id) || []
    };
    
  } catch (error) {
    console.error('❌ [DIRECT TEST] Error during direct table test:', error);
    return null;
  }
}