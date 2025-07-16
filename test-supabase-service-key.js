import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Supabase service key...');
console.log('URL:', supabaseUrl);
console.log('Service key exists:', !!supabaseServiceKey);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testConnection() {
  try {
    // Test basic connection
    const { data: players, error } = await supabase
      .from('players')
      .select('id, email')
      .limit(1);
    
    console.log('Players query result:', { players, error });
    
    // Test KYC document insert
    const { data: kycData, error: kycError } = await supabase
      .from('kyc_documents')
      .insert({
        player_id: 10,
        document_type: 'test',
        file_name: 'test.jpg',
        file_url: 'https://example.com/test.jpg',
        status: 'pending'
      })
      .select()
      .single();
    
    console.log('KYC insert result:', { kycData, kycError });
    
    if (kycData) {
      // Clean up the test record
      await supabase
        .from('kyc_documents')
        .delete()
        .eq('id', kycData.id);
      console.log('Test record cleaned up');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testConnection();