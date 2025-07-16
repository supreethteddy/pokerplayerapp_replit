import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getRealSupabaseTables() {
  console.log('Getting actual table names from Supabase database...');
  
  try {
    // Get the real table data from your Supabase database
    const { data: realTables, error } = await supabase
      .from('tables')
      .select('*')
      .order('id');

    if (error) {
      console.error('Error getting real tables:', error);
      return false;
    }

    console.log('Real table names from your Supabase database:');
    realTables?.forEach((table, index) => {
      console.log(`${index + 1}. ID: ${table.id}, Name: "${table.name}", Stakes: ${table.stakes}`);
    });

    // Show what names the user actually has vs what I've been creating
    console.log('\nFrom your screenshots, I should be using the actual table names you created in the staff portal, not generic names like "High Stakes Table"');
    
    return realTables;
    
  } catch (error) {
    console.error('Failed to get real tables:', error);
    return false;
  }
}

// Run the check
getRealSupabaseTables().catch(console.error);