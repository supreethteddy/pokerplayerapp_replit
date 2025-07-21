/**
 * GRE CHAT SYSTEM REAL-TIME CONNECTIVITY TEST
 * 
 * This script tests the complete GRE chat flow:
 * 1. Player sends message via Player Portal
 * 2. Message stores in Staff Portal Supabase
 * 3. GRE receives message in GRE Portal
 * 4. GRE replies via GRE Portal
 * 5. Player receives reply in real-time via WebSocket
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');

const PLAYER_ID = 29;
const PLAYER_NAME = 'vignesh gana';
const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/ws';

async function testGREChatSystem() {
  console.log('🚀 Starting GRE Chat System Test...\n');
  
  try {
    // Step 1: Send a message from player
    console.log('📤 Step 1: Player sends message');
    const playerMessage = await fetch(`${BASE_URL}/api/gre-chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: PLAYER_ID,
        playerName: PLAYER_NAME,
        message: 'Hello, I need help with my account balance. This is a test message.',
        timestamp: new Date().toISOString()
      })
    });
    
    if (!playerMessage.ok) {
      throw new Error(`Failed to send player message: ${playerMessage.statusText}`);
    }
    
    const playerMessageData = await playerMessage.json();
    console.log('✅ Player message sent:', playerMessageData.message.id);
    
    // Step 2: Verify message appears in chat history
    console.log('\n📋 Step 2: Verify message in chat history');
    const chatHistory = await fetch(`${BASE_URL}/api/gre-chat/messages/${PLAYER_ID}`);
    const messages = await chatHistory.json();
    console.log(`✅ Chat history contains ${messages.length} messages`);
    
    // Step 3: Test WebSocket connection (simulate player connecting)
    console.log('\n🔌 Step 3: Testing WebSocket connection');
    const ws = new WebSocket(WS_URL);
    
    let authenticationReceived = false;
    let chatHistoryReceived = false;
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      // Authenticate as player
      ws.send(JSON.stringify({
        type: 'authenticate',
        playerId: PLAYER_ID
      }));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 WebSocket message received:', message.type);
        
        if (message.type === 'authenticated') {
          authenticationReceived = true;
          console.log('🔐 Player authenticated successfully');
        } else if (message.type === 'chat_history') {
          chatHistoryReceived = true;
          console.log(`📋 Chat history received: ${message.messages?.length || 0} messages`);
        } else if (message.type === 'new_message') {
          console.log('💬 NEW MESSAGE RECEIVED:', message.message);
          console.log(`   From: ${message.message.sender_name}`);
          console.log(`   Content: ${message.message.message}`);
        }
      } catch (e) {
        console.error('❌ Failed to parse WebSocket message:', e);
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
    
    // Wait for authentication and chat history
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (authenticationReceived && chatHistoryReceived) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
    
    console.log('✅ WebSocket authentication and chat history successful');
    
    // Step 4: Test GRE response (simulate GRE portal sending message)
    console.log('\n💬 Step 4: Testing GRE response via WebSocket');
    
    const greResponse = await fetch(`${BASE_URL}/api/gre-chat/send-to-player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: PLAYER_ID,
        message: 'Hello! I can help you with your account balance. Let me check your account details.',
        greStaffName: 'Test GRE Agent'
      })
    });
    
    if (!greResponse.ok) {
      throw new Error(`Failed to send GRE message: ${greResponse.statusText}`);
    }
    
    const greResponseData = await greResponse.json();
    console.log('📤 GRE response sent:', greResponseData);
    
    // Wait for real-time message
    let newMessageReceived = false;
    const messageTimeout = setTimeout(() => {
      if (!newMessageReceived) {
        console.log('⏰ Timeout: No real-time message received after 5 seconds');
      }
    }, 5000);
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'new_message' && message.message.sender === 'gre') {
          newMessageReceived = true;
          clearTimeout(messageTimeout);
          console.log('🎉 SUCCESS: Real-time GRE message received!');
          console.log(`   Message: "${message.message.message}"`);
          console.log(`   From: ${message.message.sender_name}`);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    });
    
    // Step 5: Final verification
    setTimeout(async () => {
      console.log('\n🔍 Step 5: Final chat history verification');
      const finalHistory = await fetch(`${BASE_URL}/api/gre-chat/messages/${PLAYER_ID}`);
      const finalMessages = await finalHistory.json();
      
      console.log(`📊 Final Results:`);
      console.log(`   Total messages: ${finalMessages.length}`);
      console.log(`   WebSocket connected: ✅`);
      console.log(`   Player authenticated: ${authenticationReceived ? '✅' : '❌'}`);
      console.log(`   Chat history loaded: ${chatHistoryReceived ? '✅' : '❌'}`);
      console.log(`   Real-time messages: ${newMessageReceived ? '✅' : '❌'}`);
      
      if (authenticationReceived && chatHistoryReceived && newMessageReceived) {
        console.log('\n🎉 GRE CHAT SYSTEM TEST PASSED! All functionality working correctly.');
      } else {
        console.log('\n❌ GRE CHAT SYSTEM TEST FAILED! Some functionality not working.');
        if (!newMessageReceived) {
          console.log('   Issue: Real-time messaging not working properly');
          console.log('   Solution needed: Fix WebSocket message broadcasting');
        }
      }
      
      ws.close();
    }, 6000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Add test for WebSocket health
async function testWebSocketHealth() {
  console.log('\n🔍 Testing WebSocket Health...');
  
  try {
    const ws = new WebSocket(WS_URL);
    
    ws.on('open', () => {
      console.log('✅ WebSocket server is running and accepting connections');
      ws.close();
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket server error:', error);
    });
    
  } catch (error) {
    console.error('❌ WebSocket connection test failed:', error);
  }
}

// Run tests
testWebSocketHealth();
setTimeout(() => {
  testGREChatSystem();
}, 1000);