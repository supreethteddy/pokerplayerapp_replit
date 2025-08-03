// Test direct Supabase connection to debug API issues
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function testDirectAccess() {
  console.log('🔗 Testing direct Supabase access...');
  
  // Test 1: Tables access
  console.log('\n1. Testing tables access:');
  const tablesResult = await supabase
    .from('tables')
    .select('*')
    .limit(3);
  console.log('Tables result:', tablesResult);
  
  // Test 2: Staff offers access
  console.log('\n2. Testing staff_offers access:');
  const offersResult = await supabase
    .from('staff_offers')
    .select('*')
    .limit(3);
  console.log('Offers result:', offersResult);
  
  // Test 3: Check URL and key
  console.log('\n3. Environment check:');
  console.log('URL exists:', !!process.env.VITE_SUPABASE_URL);
  console.log('Key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('URL starts with https:', process.env.VITE_SUPABASE_URL?.startsWith('https://'));
}

testDirectAccess().catch(console.error);