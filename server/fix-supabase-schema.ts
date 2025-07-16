import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function fixSupabaseSchema() {
  try {
    console.log('Fixing Supabase schema...');
    
    // Add the supabase_id column using SQL
    const { data, error } = await supabase.rpc('execute_sql', {
      query: 'ALTER TABLE players ADD COLUMN IF NOT EXISTS supabase_id TEXT;'
    });
    
    if (error) {
      console.error('Error adding supabase_id column:', error);
      return false;
    }
    
    console.log('Column added successfully');
    return true;
    
  } catch (error) {
    console.error('Schema fix failed:', error);
    return false;
  }
}