import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteCreatedTables() {
  console.log('🗑️ [DELETE] Deleting the Indian poker room tables I created...');
  
  try {
    // Delete all the tables I just created (IDs 165-172)
    const { error } = await supabase
      .from('tables')
      .delete()
      .gte('id', 165)
      .lte('id', 172);

    if (error) {
      console.error('❌ [DELETE] Error deleting created tables:', error);
      return { success: false, error };
    }

    console.log('✅ [DELETE] Successfully deleted all created Indian poker room tables');

    // Check final count
    const { count, error: countError } = await supabase
      .from('tables')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`📊 [DELETE] Remaining tables in database: ${count}`);
    }

    return { success: true, count };

  } catch (error) {
    console.error('❌ [DELETE] Error:', error);
    return { success: false, error };
  }
}

// Run the deletion
deleteCreatedTables().then(result => {
  console.log('🎯 [DELETE] Result:', result);
  process.exit(0);
}).catch(error => {
  console.error('💥 [DELETE] Fatal error:', error);
  process.exit(1);
});