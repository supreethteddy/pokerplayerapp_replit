// STAFF PORTAL CHAT INTEGRATION TEST
// This script tests the exact message format expected by Staff Portal

import WebSocket from 'ws';

console.log('🧪 TESTING STAFF PORTAL CHAT INTEGRATION');
console.log('==========================================');

// Connect to the WebSocket server
const ws = new WebSocket('ws://localhost:5000/chat-ws');

ws.on('open', function open() {
  console.log('✅ Connected to WebSocket server');
  
  // Step 1: Authenticate with EXACT Staff Portal format
  console.log('\n📡 Step 1: Authenticating with Staff Portal format...');
  const authMessage = {
    type: 'authenticate',
    playerId: 29,
    playerName: 'vignesh gana',  
    playerEmail: 'vignesh.wildleaf@gmail.com'
  };
  
  console.log('📤 Sending auth message:', JSON.stringify(authMessage, null, 2));
  ws.send(JSON.stringify(authMessage));
});

ws.on('message', function message(data) {
  const response = JSON.parse(data.toString());
  console.log('📨 Received response:', JSON.stringify(response, null, 2));
  
  if (response.type === 'authenticated') {
    console.log('\n✅ Authentication successful! Now sending test message...');
    
    // Step 2: Send message with EXACT Staff Portal format  
    const chatMessage = {
      type: 'player_message',              // EXACT string expected by Staff Portal
      playerId: 29,                        // Integer from database
      playerName: 'vignesh gana',          // Player's full name
      playerEmail: 'vignesh.wildleaf@gmail.com', // Valid email address
      message: 'TEST: Staff Portal Integration - Can you see this message?', // The actual message content
      messageText: 'TEST: Staff Portal Integration - Can you see this message?', // Duplicate for compatibility
      timestamp: new Date().toISOString()  // ISO timestamp string
    };
    
    console.log('📤 Sending EXACT Staff Portal message format:');
    console.log(JSON.stringify(chatMessage, null, 2));
    ws.send(JSON.stringify(chatMessage));
  }
  
  if (response.type === 'acknowledgment') {
    console.log('\n🎉 SUCCESS: Message acknowledged by server!');
    console.log('🔍 Check Staff Portal GRE interface for the message');
    console.log('📋 Message should appear in Supabase gre_chat_messages table');
    
    // Keep connection open for a bit to see any other responses
    setTimeout(() => {
      console.log('\n🔌 Closing connection...');
      ws.close();
    }, 3000);
  }
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('🔌 Connection closed');
  console.log('\n📊 TEST SUMMARY:');
  console.log('================');
  console.log('✓ Connected to WebSocket server');
  console.log('✓ Sent authentication with Staff Portal format');
  console.log('✓ Sent chat message with EXACT Staff Portal format');
  console.log('✓ Received acknowledgment from server');
  console.log('\n🎯 Next Steps:');
  console.log('1. Check Staff Portal GRE interface for the test message');
  console.log('2. Verify message appears in Supabase gre_chat_messages table');
  console.log('3. Confirm Staff Portal can respond to the message');
});