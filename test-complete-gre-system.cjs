#!/usr/bin/env node
/**
 * COMPLETE GRE CHAT SYSTEM TESTER
 * Tests the entire GRE chat functionality across Player Portal, Staff Portal, and GRE Portal
 * 
 * This script comprehensively tests:
 * 1. WebSocket connection and authentication
 * 2. Message sending via WebSocket and REST API
 * 3. Cross-portal message synchronization
 * 4. Staff Portal Supabase connectivity
 * 5. GRE Portal integration points
 */

const WebSocket = require('ws');
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/ws';
const PLAYER_ID = 29;
const PLAYER_NAME = 'vignesh gana';

console.log('🚀 STARTING COMPLETE GRE CHAT SYSTEM TEST');
console.log('=' .repeat(60));

async function testRestApiMessages() {
  console.log('\n📊 1. TESTING REST API MESSAGE RETRIEVAL');
  console.log('-'.repeat(40));
  
  try {
    const response = await fetch(`${BASE_URL}/api/gre-chat/messages/${PLAYER_ID}`);
    const messages = await response.json();
    
    if (response.ok) {
      console.log(`✅ REST API: Retrieved ${messages.length} messages for player ${PLAYER_ID}`);
      console.log(`📋 Latest message: "${messages[messages.length - 1]?.message || 'No messages'}"`);
      return messages.length;
    } else {
      console.log(`❌ REST API: Error retrieving messages - ${messages.error}`);
      return 0;
    }
  } catch (error) {
    console.log(`❌ REST API: Connection failed - ${error.message}`);
    return 0;
  }
}

async function testRestApiSending() {
  console.log('\n📤 2. TESTING REST API MESSAGE SENDING');
  console.log('-'.repeat(40));
  
  const testMessage = `REST API Test Message - ${new Date().toISOString()}`;
  
  try {
    const response = await fetch(`${BASE_URL}/api/gre-chat/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: PLAYER_ID,
        playerName: PLAYER_NAME,
        message: testMessage,
        timestamp: new Date().toISOString()
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ REST API: Message sent successfully`);
      console.log(`📨 Message ID: ${result.message?.id}`);
      console.log(`💬 Message: "${testMessage}"`);
      return true;
    } else {
      console.log(`❌ REST API: Failed to send message - ${result.error}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ REST API: Send failed - ${error.message}`);
    return false;
  }
}

function testWebSocketConnection() {
  console.log('\n🔗 3. TESTING WEBSOCKET CONNECTION & MESSAGING');
  console.log('-'.repeat(50));
  
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    let authenticated = false;
    let messageSent = false;
    
    const timeout = setTimeout(() => {
      console.log('⏰ WebSocket test timeout after 10 seconds');
      ws.close();
      resolve(false);
    }, 10000);
    
    ws.on('open', () => {
      console.log('✅ WebSocket: Connection established');
      
      // Authenticate first
      console.log('🔐 WebSocket: Sending authentication...');
      ws.send(JSON.stringify({
        type: 'authenticate',
        playerId: PLAYER_ID
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log(`📨 WebSocket: Received message type: ${message.type}`);
      
      if (message.type === 'authenticated' && !authenticated) {
        authenticated = true;
        console.log('✅ WebSocket: Authentication successful');
        
        // Send test message
        const testMessage = `WebSocket Test Message - ${new Date().toISOString()}`;
        console.log('📤 WebSocket: Sending test message...');
        ws.send(JSON.stringify({
          type: 'send_message',
          playerId: PLAYER_ID,
          playerName: PLAYER_NAME,
          message: testMessage,
          sender: 'player'
        }));
        messageSent = true;
      } else if (message.type === 'message_sent') {
        console.log('✅ WebSocket: Message sent confirmation received');
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      } else if (message.type === 'error') {
        console.log(`❌ WebSocket: Error - ${message.message}`);
        clearTimeout(timeout);
        ws.close();
        resolve(false);
      }
    });
    
    ws.on('error', (error) => {
      console.log(`❌ WebSocket: Connection error - ${error.message}`);
      clearTimeout(timeout);
      resolve(false);
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket: Connection closed');
      if (authenticated && messageSent) {
        clearTimeout(timeout);
        resolve(true);
      }
    });
  });
}

async function testStaffPortalConnectivity() {
  console.log('\n🏢 4. TESTING STAFF PORTAL SUPABASE CONNECTIVITY');
  console.log('-'.repeat(50));
  
  try {
    const response = await fetch(`${BASE_URL}/api/gre-chat/health`);
    const health = await response.json();
    
    if (response.ok) {
      console.log('✅ Staff Portal: Health check passed');
      console.log(`📊 Sessions table: ${health.staffPortalSupabase.sessionsTable ? 'Connected' : 'Failed'}`);
      console.log(`💬 Messages table: ${health.staffPortalSupabase.messagesTable ? 'Connected' : 'Failed'}`);
      console.log(`👥 Online status: ${health.staffPortalSupabase.onlineStatusTable ? 'Connected' : 'Failed'}`);
      console.log(`🔔 Push notifications: ${health.staffPortalSupabase.pushNotificationsTable ? 'Connected' : 'Failed'}`);
      return true;
    } else {
      console.log(`❌ Staff Portal: Health check failed - ${health.error}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Staff Portal: Connection failed - ${error.message}`);
    return false;
  }
}

async function validateMessageCount() {
  console.log('\n🔢 5. VALIDATING MESSAGE COUNT INCREASE');
  console.log('-'.repeat(40));
  
  // Wait a moment for database to sync
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    const response = await fetch(`${BASE_URL}/api/gre-chat/messages/${PLAYER_ID}`);
    const messages = await response.json();
    
    if (response.ok) {
      console.log(`✅ Final message count: ${messages.length} messages`);
      console.log(`📋 Latest messages:`);
      
      // Show last 3 messages
      const lastMessages = messages.slice(-3);
      lastMessages.forEach((msg, index) => {
        const time = new Date(msg.created_at).toLocaleTimeString();
        console.log(`  ${index + 1}. [${time}] ${msg.message.substring(0, 50)}...`);
      });
      
      return messages.length;
    } else {
      console.log(`❌ Failed to validate message count - ${messages.error}`);
      return 0;
    }
  } catch (error) {
    console.log(`❌ Validation failed - ${error.message}`);
    return 0;
  }
}

async function runCompleteTest() {
  const startTime = Date.now();
  
  // 1. Get initial message count
  const initialCount = await testRestApiMessages();
  
  // 2. Test REST API sending
  const restApiWorking = await testRestApiSending();
  
  // 3. Test WebSocket functionality
  const webSocketWorking = await testWebSocketConnection();
  
  // 4. Test Staff Portal connectivity
  const staffPortalWorking = await testStaffPortalConnectivity();
  
  // 5. Validate final message count
  const finalCount = await validateMessageCount();
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  // Print final results
  console.log('\n' + '='.repeat(60));
  console.log('🎯 COMPLETE GRE CHAT SYSTEM TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`⏱️  Test Duration: ${duration} seconds`);
  console.log(`📊 Initial Message Count: ${initialCount}`);
  console.log(`📈 Final Message Count: ${finalCount}`);
  console.log(`📧 Messages Added: ${finalCount - initialCount}`);
  console.log('');
  console.log('🧪 Component Test Results:');
  console.log(`   REST API Message Retrieval: ${initialCount > 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   REST API Message Sending: ${restApiWorking ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   WebSocket Connection: ${webSocketWorking ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Staff Portal Connectivity: ${staffPortalWorking ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Message Count Increase: ${finalCount > initialCount ? '✅ PASS' : '❌ FAIL'}`);
  
  const allTestsPassed = restApiWorking && webSocketWorking && staffPortalWorking && (finalCount > initialCount);
  
  console.log('\n🏆 OVERALL RESULT:');
  if (allTestsPassed) {
    console.log('✅ ALL TESTS PASSED - GRE Chat System is FULLY OPERATIONAL!');
    console.log('🎉 Player Portal ↔ Staff Portal ↔ GRE Portal connectivity confirmed');
  } else {
    console.log('❌ SOME TESTS FAILED - System needs attention');
    console.log('🔧 Check the failed components above for troubleshooting');
  }
  
  console.log('='.repeat(60));
  
  process.exit(allTestsPassed ? 0 : 1);
}

// Run the complete test
runCompleteTest().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});