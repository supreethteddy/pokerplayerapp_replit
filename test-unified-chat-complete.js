
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000';
const PLAYER_ID = 29;
const PLAYER_NAME = 'vignesh gana';

async function testCompleteUnifiedChat() {
  console.log('🧪 [CHAT TEST] Starting comprehensive unified chat system test...\n');

  try {
    // Test 1: Send a player message
    console.log('📨 Test 1: Send Player Message');
    const playerMessageResponse = await fetch(`${BASE_URL}/api/unified-chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: PLAYER_ID,
        playerName: PLAYER_NAME,
        message: `Test message from player at ${new Date().toISOString()}`,
        senderType: 'player'
      })
    });

    const playerResult = await playerMessageResponse.json();
    console.log('Player message result:', playerResult.success ? '✅ PASS' : '❌ FAIL');
    if (playerResult.success) {
      console.log(`  - Message ID: ${playerResult.data.id}`);
      console.log(`  - Timestamp: ${playerResult.data.timestamp}`);
    } else {
      console.log(`  - Error: ${playerResult.error}`);
    }

    // Test 2: Send a GRE response
    console.log('\n📨 Test 2: Send GRE Response');
    const greMessageResponse = await fetch(`${BASE_URL}/api/unified-chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: PLAYER_ID,
        playerName: PLAYER_NAME,
        message: `GRE response to player at ${new Date().toISOString()}`,
        senderType: 'gre'
      })
    });

    const greResult = await greMessageResponse.json();
    console.log('GRE message result:', greResult.success ? '✅ PASS' : '❌ FAIL');
    if (greResult.success) {
      console.log(`  - Message ID: ${greResult.data.id}`);
      console.log(`  - Timestamp: ${greResult.data.timestamp}`);
    } else {
      console.log(`  - Error: ${greResult.error}`);
    }

    // Test 3: Retrieve chat history
    console.log('\n📋 Test 3: Retrieve Chat History');
    const historyResponse = await fetch(`${BASE_URL}/api/unified-chat/messages/${PLAYER_ID}`);
    
    if (historyResponse.ok) {
      const messages = await historyResponse.json();
      console.log('Chat history result: ✅ PASS');
      console.log(`  - Total messages: ${messages.length}`);
      console.log('  - Recent messages:');
      messages.slice(-3).forEach(msg => {
        console.log(`    ${msg.sender}: ${msg.message.substring(0, 50)}... (${msg.timestamp})`);
      });
    } else {
      console.log('Chat history result: ❌ FAIL');
      console.log(`  - Error: ${historyResponse.statusText}`);
    }

    // Test 4: Test real-time connection
    console.log('\n🔄 Test 4: Real-time Connection Test');
    const connectionResponse = await fetch(`${BASE_URL}/api/unified-chat/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: PLAYER_ID })
    });

    const connectionResult = await connectionResponse.json();
    console.log('Connection test result:', connectionResult.success ? '✅ PASS' : '❌ FAIL');
    if (connectionResult.success) {
      console.log(`  - Player Channel: ${connectionResult.pusher.playerChannel}`);
      console.log(`  - Staff Channel: ${connectionResult.pusher.staffChannel}`);
      console.log(`  - Cluster: ${connectionResult.pusher.cluster}`);
    } else {
      console.log(`  - Error: ${connectionResult.error}`);
    }

    console.log('\n🎯 [FINAL] All chat system tests completed');

  } catch (error) {
    console.error('❌ [FATAL] Test failed:', error.message);
  }
}

// Run the complete test
testCompleteUnifiedChat();
