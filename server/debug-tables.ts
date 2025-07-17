import { createClient } from '@supabase/supabase-js';

// Debug script to check all tables in Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function debugAllTables() {
  console.log('🔍 [DEBUG] SUPABASE EXCLUSIVE MODE - Checking all tables in Supabase database...');
  
  try {
    // Get all tables without any filters or limits - EXHAUSTIVE search
    const { data: allTables, error, count } = await supabase
      .from('tables')
      .select('*', { count: 'exact' })
      .order('id', { ascending: false })
      .limit(10000); // Ensure we get ALL tables, not just default limit
    
    if (error) {
      console.error('❌ [DEBUG] Error fetching all tables:', error);
      return;
    }
    
    console.log(`📊 [DEBUG] SUPABASE EXCLUSIVE - Total tables found: ${count}`);
    console.log(`📋 [DEBUG] SUPABASE EXCLUSIVE - Fetched ${allTables?.length || 0} tables`);
    
    if (allTables && allTables.length > 0) {
      console.log('🎯 [DEBUG] SUPABASE EXCLUSIVE - All table IDs:', allTables.map(t => t.id).join(', '));
      console.log('📝 [DEBUG] SUPABASE EXCLUSIVE - All table names:', allTables.map(t => t.name).join(', '));
      
      // Check for tables with specific patterns from screenshot
      const specialTables = allTables.filter(t => 
        t.name.includes('Manager') || 
        t.name.includes('Supabase') || 
        t.name.includes('Staff') ||
        t.name.includes('Action') ||
        t.name.includes('Portal') ||
        t.name.includes('Master') ||
        t.name.includes('Cashier')
      );
      
      if (specialTables.length > 0) {
        console.log('🎯 [DEBUG] SUPABASE EXCLUSIVE - Found special tables:', specialTables.map(t => t.name).join(', '));
      }
      
      // Check for hidden or inactive tables
      const inactiveTables = allTables.filter(t => t.is_active === false);
      if (inactiveTables.length > 0) {
        console.log('🔍 [DEBUG] SUPABASE EXCLUSIVE - Found inactive tables:', inactiveTables.map(t => t.name).join(', '));
      }
    }
    
    return allTables;
  } catch (error) {
    console.error('❌ [DEBUG] SUPABASE EXCLUSIVE - Exception during table debug:', error);
  }
}