import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.STAFF_PORTAL_SUPABASE_URL!,
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY!
);

async function testSystem() {
  console.log('🔧 Testing both tables and KYC upload functionality...');
  
  // Test 1: Check tables
  console.log('\n1. Testing table retrieval:');
  const { data: tables, error: tablesError } = await supabase
    .from('poker_tables')
    .select('*')
    .limit(5);
  
  console.log('Tables found:', tables?.length || 0);
  console.log('Error:', tablesError?.message || 'None');
  if (tables && tables.length > 0) {
    console.log('Sample table:', tables[0]);
  }
  
  // Test 2: Check KYC upload
  console.log('\n2. Testing KYC upload:');
  const testData = {
    playerId: 15,
    documentType: 'government_id',
    fileName: 'test.png',
    dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  };
  
  console.log('Test data:', {
    playerId: testData.playerId,
    documentType: testData.documentType,
    fileName: testData.fileName,
    dataUrlLength: testData.dataUrl.length
  });
  
  try {
    const response = await fetch('http://localhost:5000/api/kyc-documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    console.log('Upload response:', result);
  } catch (error) {
    console.log('Upload error:', error);
  }
  
  // Test 3: Check if tables endpoint is working
  console.log('\n3. Testing tables endpoint:');
  try {
    const response = await fetch('http://localhost:5000/api/tables');
    const result = await response.json();
    console.log('Tables endpoint response:', result.length, 'tables');
  } catch (error) {
    console.log('Tables endpoint error:', error);
  }
}

testSystem().then(() => {
  console.log('\n✅ System test complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ System test failed:', error);
  process.exit(1);
});