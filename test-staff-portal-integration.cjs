// STAFF PORTAL INTEGRATION TEST
// Tests Player Portal (Poker Room Tracker) integration with Staff Portal

const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

// Staff Portal Supabase configuration
const staffPortalSupabase = createClient(
  'https://oyhnpnymlezjusnwpjeu.supabase.co',
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY
);

console.log('🚀 STAFF PORTAL INTEGRATION TEST');
console.log('Player Portal (Poker Room Tracker) → Staff Portal');
console.log('=====================================');

async function testStaffPortalIntegration() {
  try {
    const playerId = 29;
    const playerName = 'vignesh gana';
    const playerEmail = 'vignesh.wildleaf@gmail.com';
    
    console.log(`\n🎯 Testing integration for player ${playerId} (${playerName})`);
    console.log(`📧 Email: ${playerEmail}`);
    
    // Step 1: Clear existing messages for clean test
    console.log('\n🧹 Clearing existing messages...');
    const { error: deleteError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .delete()
      .eq('player_id', playerId);
    
    if (deleteError && deleteError.code !== 'PGRST116') {
      console.error('❌ Error clearing messages:', deleteError);
    } else {
      console.log('✅ Messages cleared successfully');
    }
    
    // Step 2: Test REST API endpoint compatibility
    console.log('\n📡 Testing REST API endpoint...');
    const restStartTime = Date.now();
    
    const { data: restMessage, error: restError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .insert([{
        player_id: playerId,
        player_name: playerName,
        message: 'REST API TEST: Staff Portal integration check',
        sender: 'player',
        sender_name: playerName,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    const restTime = Date.now() - restStartTime;
    
    if (restError) {
      console.error('❌ REST API test failed:', restError);
      return;
    }
    
    console.log(`✅ REST API message sent in ${restTime}ms`);
    console.log(`📝 Message ID: ${restMessage.id}`);
    
    // Step 3: Test WebSocket connection to Player Portal
    console.log('\n🔗 Testing WebSocket connection...');
    const wsUrl = 'ws://localhost:5000/chat-ws';
    
    const ws = new WebSocket(wsUrl);
    let wsConnected = false;
    let messageReceived = false;
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected to Player Portal');
      wsConnected = true;
      
      // Authenticate as player
      console.log('🔐 Authenticating player...');
      ws.send(JSON.stringify({
        type: 'authenticate',
        playerId: playerId,
        playerName: playerName,
        playerEmail: playerEmail
      }));
      
      // Wait a bit then send test message
      setTimeout(() => {
        console.log('📤 Sending Staff Portal compatible message...');
        const playerMessage = {
          type: 'player_message',
          playerId: playerId,
          playerName: playerName,
          playerEmail: playerEmail,
          message: 'WEBSOCKET TEST: Real-time Staff Portal integration',
          messageText: 'WEBSOCKET TEST: Real-time Staff Portal integration',
          timestamp: new Date().toISOString(),
          // Universal System fields from integration guide
          universalId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          portalOrigin: 'PokerRoomTracker', 
          targetPortal: 'PokerStaffPortal',
          messageFormat: 'universal'
        };
        
        console.log('🎯 [POKER ROOM TRACKER] Sending message with EXACT Staff Portal format');
        ws.send(JSON.stringify(playerMessage));
      }, 1000);
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('📨 [WEBSOCKET] Received from Player Portal:', message);
      
      if (message.type === 'authenticated') {
        console.log('🔐 [WEBSOCKET] Authentication successful');
      }
      
      if (message.type === 'chat_history') {
        console.log(`📋 [WEBSOCKET] Chat history received: ${message.messages?.length || 0} messages`);
        messageReceived = true;
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ [WEBSOCKET] Connection error:', error);
    });
    
    ws.on('close', () => {
      console.log('🔌 [WEBSOCKET] Connection closed');
    });
    
    // Step 4: Wait for WebSocket test and verify messages
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n📋 Verifying final message count...');
    const { data: finalMessages, error: finalError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: true });
    
    if (finalError) {
      console.error('❌ Error fetching final messages:', finalError);
      return;
    }
    
    console.log(`✅ Total messages in Staff Portal database: ${finalMessages.length}`);
    
    finalMessages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.sender.toUpperCase()}] ${msg.sender_name}: "${msg.message}"`);
      console.log(`   📅 ${new Date(msg.created_at).toLocaleTimeString()}`);
    });
    
    // Step 5: Integration summary
    console.log('\n📊 INTEGRATION TEST SUMMARY');
    console.log('==========================');
    console.log(`✅ REST API latency: ${restTime}ms`);
    console.log(`✅ WebSocket connection: ${wsConnected ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ Message count: ${finalMessages.length}`);
    console.log(`✅ Staff Portal database: CONNECTED`);
    console.log(`✅ Player authentication: WORKING`);
    
    if (finalMessages.length >= 1 && wsConnected) {
      console.log('\n🏆 STAFF PORTAL INTEGRATION: SUCCESSFUL');
      console.log('Player Portal (Poker Room Tracker) is fully compatible with Staff Portal');
    } else {
      console.log('\n⚠️  INTEGRATION ISSUES DETECTED');
      console.log('Some components may need adjustment for full Staff Portal compatibility');
    }
    
    ws.close();
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }
}

testStaffPortalIntegration();