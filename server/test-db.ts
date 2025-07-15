import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function testConnection() {
  console.log('Testing Supabase connection...');
  console.log('URL:', supabaseUrl);
  console.log('Service Role Key exists:', !!supabaseServiceRoleKey);
  
  try {
    // Test with different queries to see what's available
    console.log('Testing players table...');
    const { data: playersData, error: playersError } = await supabase.from('players').select('*');
    console.log('Players query result:', { data: playersData, error: playersError });
    
    console.log('Testing specific player...');
    const { data: specificPlayer, error: specificError } = await supabase.from('players').select('*').eq('email', 'vigneshthc@gmail.com');
    console.log('Specific player query result:', { data: specificPlayer, error: specificError });
    
    console.log('Testing count...');
    const { count, error: countError } = await supabase.from('players').select('*', { count: 'exact' });
    console.log('Count result:', { count, error: countError });
    
  } catch (error) {
    console.error('Exception:', error);
  }
}

testConnection();