// Test the Player Portal chat integration after frontend updates
const fetch = require('node-fetch');

async function testPlayerPortalChat() {
  console.log('🧪 [CHAT TEST] Testing Player Portal chat integration...');
  
  const API_BASE = 'http://localhost:5000/api';
  
  try {
    // Test 1: Check sync status
    console.log('\n🔍 [TEST 1] Checking unified sync status...');
    const statusResponse = await fetch(`${API_BASE}/unified-sync-status`);
    const statusData = await statusResponse.json();
    
    console.log(`Status: ${statusData.status}`);
    console.log(`Database: ${statusData.database}`);
    console.log(`Connected: ${statusResponse.ok ? 'YES' : 'NO'}`);

    // Test 2: Send a test message via unified API
    console.log('\n📤 [TEST 2] Sending test message via unified chat API...');
    const messageResponse = await fetch(`${API_BASE}/unified-chat-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        playerId: 29,
        playerName: 'Vignesh Gana (Chat Test)',
        playerEmail: 'vignesh.wildleaf@gmail.com',
        message: 'CHAT INTEGRATION TEST: Player Portal unified chat system is ready for Staff Portal - ' + new Date().toISOString(),
        priority: 'urgent',
        source: 'poker_room_tracker'
      })
    });

    const messageData = await messageResponse.json();
    console.log(`Response: ${messageResponse.status} ${messageResponse.statusText}`);
    console.log('Data:', messageData);

    // Test 3: Retrieve messages
    console.log('\n📋 [TEST 3] Retrieving chat requests...');
    const getResponse = await fetch(`${API_BASE}/unified-chat-requests`);
    const getData = await getResponse.json();
    
    console.log(`Response: ${getResponse.status} ${getResponse.statusText}`);
    if (getData.success) {
      console.log(`Found ${getData.requests?.length || 0} requests`);
    } else {
      console.log('Error:', getData.error);
    }

    // Test 4: Legacy GRE chat endpoint
    console.log('\n🔄 [TEST 4] Testing legacy GRE chat endpoint...');
    const greResponse = await fetch(`${API_BASE}/gre-chat/messages/29`);
    const greData = await greResponse.json();
    
    console.log(`Response: ${greResponse.status} ${greResponse.statusText}`);
    console.log(`Messages: ${Array.isArray(greData) ? greData.length : 'Error'}`);

    console.log('\n🎉 [TEST COMPLETE] Player Portal chat integration tests finished');
    console.log('\n📋 [SUMMARY] Test Results:');
    console.log(`✅ API Server: Running on port 5000`);
    console.log(`${statusData.status === 'connected' ? '✅' : '⚠️'} Database Connection: ${statusData.status}`);
    console.log(`${messageResponse.ok ? '✅' : '❌'} Message Sending: ${messageResponse.ok ? 'Working' : 'Failed'}`);
    console.log(`${getResponse.ok ? '✅' : '❌'} Message Retrieval: ${getResponse.ok ? 'Working' : 'Failed'}`);

    if (!messageResponse.ok || !getResponse.ok) {
      console.log('\n⚠️ [WAITING FOR STAFF PORTAL] Tables need to be created in Staff Portal Supabase');
      console.log('   Staff Portal team should execute: staff-portal-chat-tables.sql');
      console.log('   Once tables are created, integration will work immediately');
    }

  } catch (error) {
    console.error('❌ [TEST ERROR]', error.message);
  }
}

testPlayerPortalChat();