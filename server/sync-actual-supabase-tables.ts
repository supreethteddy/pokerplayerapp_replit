import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function syncActualSupabaseTables() {
  console.log('Checking actual Supabase tables from screenshot...');
  
  try {
    // Get current tables from Supabase
    const { data: currentTables, error: fetchError } = await supabase
      .from('tables')
      .select('*')
      .order('id');

    if (fetchError) {
      console.error('Error fetching current tables:', fetchError);
      return false;
    }

    console.log('Current tables in Supabase:');
    currentTables?.forEach(table => {
      console.log(`- ID: ${table.id}, Name: ${table.name}, Stakes: ${table.stakes}, Status: ${table.status || 'N/A'}`);
    });

    // Based on the screenshot, let me verify if these match what user sees
    // The screenshot shows multiple tables with "waiting" status and various stakes
    
    return true;
    
  } catch (error) {
    console.error('Failed to sync actual Supabase tables:', error);
    return false;
  }
}

// Run the sync
syncActualSupabaseTables().catch(console.error);