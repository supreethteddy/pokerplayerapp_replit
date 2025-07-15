import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Service role key exists:', !!supabaseServiceRoleKey);

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function testSupabase() {
  try {
    // Test basic connection
    console.log('Testing basic connection...');
    const { data, error } = await supabase.from('players').select('*');
    
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Success! Found', data.length, 'players');
      console.log('First player:', data[0]);
    }
    
    // Test specific email query
    console.log('\nTesting specific email query...');
    const { data: emailData, error: emailError } = await supabase
      .from('players')
      .select('*')
      .eq('email', 'test@example.com');
    
    if (emailError) {
      console.error('Email query error:', emailError);
    } else {
      console.log('Email query success:', emailData);
    }
    
  } catch (error) {
    console.error('Exception:', error);
  }
}

testSupabase();