import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    console.log('URL:', process.env.VITE_SUPABASE_URL);
    console.log('Service role key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Test 1: Basic connection
    const { data: selectData, error: selectError } = await supabase
      .from('players')
      .select('*')
      .limit(1);
    
    console.log('Basic select test:', { data: selectData, error: selectError });
    
    // Test 2: Check if supabase_id column exists
    const { data: columnData, error: columnError } = await supabase
      .from('players')
      .select('supabase_id')
      .limit(1);
    
    console.log('Column test:', { data: columnData, error: columnError });
    
    // Test 3: Look for specific user
    const { data: userData, error: userError } = await supabase
      .from('players')
      .select('*')
      .eq('supabase_id', '27c6db20-282a-4af0-9473-ea31b63ba6e7');
    
    console.log('User lookup test:', { data: userData, error: userError });
    
    return {
      success: true,
      tests: {
        basicSelect: { data: selectData, error: selectError },
        columnCheck: { data: columnData, error: columnError },
        userLookup: { data: userData, error: userError }
      }
    };
    
  } catch (error) {
    console.error('Test failed:', error);
    return { success: false, error: error.message };
  }
}