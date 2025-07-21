const fetch = require('node-fetch');

const PLAYER_ID = 29;
const BASE_URL = 'http://localhost:5000';

async function testGREDirectMessage() {
  console.log('🚀 Testing GRE Direct Message...\n');
  
  try {
    // Test sending GRE message to player
    console.log('📤 Sending GRE message to player');
    const response = await fetch(`${BASE_URL}/api/gre-chat/send-to-player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: PLAYER_ID,
        message: 'Hello! This is a test message from the GRE portal. I can help you with your account.',
        greStaffName: 'Test GRE Agent'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send GRE message: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('📋 Response:', result);
    
    // Wait a moment and check messages
    setTimeout(async () => {
      console.log('\n🔍 Checking chat messages...');
      const messagesResponse = await fetch(`${BASE_URL}/api/gre-chat/messages/${PLAYER_ID}`);
      const messages = await messagesResponse.json();
      
      console.log(`📊 Total messages: ${messages.length}`);
      messages.forEach((msg, idx) => {
        console.log(`   ${idx + 1}. ${msg.sender_name}: "${msg.message}"`);
      });
      
      console.log('\n✅ GRE Chat Direct Test Complete');
    }, 1000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testGREDirectMessage();