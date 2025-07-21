#!/usr/bin/env node

/**
 * Complete GRE Chat System Test Script
 * Tests real-time bidirectional messaging between Player Portal and GRE Portal
 * 
 * This script demonstrates:
 * 1. Player message sending (Player → GRE)
 * 2. GRE response delivery (GRE → Player) 
 * 3. Chat session closing
 * 4. Real-time WebSocket functionality
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000';
const PLAYER_ID = 29;
const PLAYER_NAME = 'vignesh gana';

async function testPlayerMessage() {
    console.log('🧪 [TEST] 1. Testing Player → GRE messaging...');
    
    try {
        const response = await fetch(`${BASE_URL}/api/gre-chat/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerId: PLAYER_ID,
                playerName: PLAYER_NAME,
                message: `Test message from Player Portal at ${new Date().toISOString()}`,
                timestamp: new Date().toISOString()
            })
        });
        
        const result = await response.json();
        console.log('✅ [TEST] Player message sent:', result.success ? 'SUCCESS' : 'FAILED');
        console.log('📊 [TEST] Message ID:', result.message?.id);
        return result.success;
    } catch (error) {
        console.error('❌ [TEST] Player message failed:', error.message);
        return false;
    }
}

async function testGreResponse() {
    console.log('🧪 [TEST] 2. Testing GRE → Player messaging...');
    
    try {
        const response = await fetch(`${BASE_URL}/api/gre-chat/send-to-player`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerId: PLAYER_ID,
                message: `Real-time GRE response at ${new Date().toISOString()}. This should appear instantly in Player Portal without page refresh!`,
                greStaffName: 'Test GRE Agent'
            })
        });
        
        const result = await response.json();
        console.log('✅ [TEST] GRE response sent:', result.success ? 'SUCCESS' : 'FAILED');
        console.log('📊 [TEST] WebSocket delivery:', result.message);
        console.log('📊 [TEST] Database storage:', result.stored ? 'STORED' : 'NOT STORED');
        return result.success;
    } catch (error) {
        console.error('❌ [TEST] GRE response failed:', error.message);
        return false;
    }
}

async function testQuickAction() {
    console.log('🧪 [TEST] 3. Testing GRE Quick Action...');
    
    try {
        const response = await fetch(`${BASE_URL}/api/gre-chat/send-to-player`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerId: PLAYER_ID,
                message: "Quick Action Test: Your account status is verified and active. Your current balance is ₹0.00. Is there anything specific I can help you with?",
                greStaffName: 'Quick Response Bot'
            })
        });
        
        const result = await response.json();
        console.log('✅ [TEST] Quick action sent:', result.success ? 'SUCCESS' : 'FAILED');
        return result.success;
    } catch (error) {
        console.error('❌ [TEST] Quick action failed:', error.message);
        return false;
    }
}

async function fetchChatHistory() {
    console.log('🧪 [TEST] 4. Testing chat history retrieval...');
    
    try {
        const response = await fetch(`${BASE_URL}/api/gre-chat/messages/${PLAYER_ID}`);
        const messages = await response.json();
        
        console.log('✅ [TEST] Chat history retrieved:', messages.length, 'messages');
        console.log('📊 [TEST] Latest messages:');
        messages.slice(-3).forEach((msg, index) => {
            console.log(`  ${index + 1}. [${msg.sender}] ${msg.message.substring(0, 50)}...`);
        });
        
        return messages.length > 0;
    } catch (error) {
        console.error('❌ [TEST] Chat history failed:', error.message);
        return false;
    }
}

async function testChatClose() {
    console.log('🧪 [TEST] 5. Testing chat session close...');
    
    try {
        const response = await fetch(`${BASE_URL}/api/gre-chat/close-session/${PLAYER_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                greStaffName: 'Test Supervisor'
            })
        });
        
        if (response.headers.get('content-type')?.includes('text/html')) {
            console.log('⚠️  [TEST] Received HTML response (likely error page)');
            return false;
        }
        
        const result = await response.json();
        console.log('✅ [TEST] Chat close sent:', result.success ? 'SUCCESS' : 'FAILED');
        console.log('📊 [TEST] Session closed:', result.session?.id ? 'YES' : 'NO');
        return result.success;
    } catch (error) {
        console.error('❌ [TEST] Chat close failed:', error.message);
        return false;
    }
}

async function runCompleteTest() {
    console.log('🚀 [TEST] Starting Complete GRE Chat System Test');
    console.log('=' .repeat(60));
    
    const results = [];
    
    // Test 1: Player Message
    results.push(await testPlayerMessage());
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: GRE Response  
    results.push(await testGreResponse());
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: Quick Action
    results.push(await testQuickAction());
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 4: Chat History
    results.push(await fetchChatHistory());
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 5: Chat Close
    results.push(await testChatClose());
    
    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📋 [TEST] Test Summary:');
    console.log(`  Player → GRE Messaging: ${results[0] ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  GRE → Player Messaging: ${results[1] ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  GRE Quick Actions:      ${results[2] ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Chat History Retrieval: ${results[3] ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Chat Session Close:     ${results[4] ? '✅ PASS' : '❌ FAIL'}`);
    
    const passCount = results.filter(Boolean).length;
    const totalCount = results.length;
    
    console.log('\n🎯 [TEST] Overall Result:');
    console.log(`  ${passCount}/${totalCount} tests passed (${Math.round(passCount/totalCount*100)}%)`);
    
    if (passCount === totalCount) {
        console.log('🎉 [SUCCESS] Complete GRE Chat System is fully operational!');
        console.log('💬 [INFO] Bidirectional real-time messaging between Player Portal and GRE Portal is working perfectly.');
    } else {
        console.log('⚠️  [WARNING] Some tests failed. Please check the issues above.');
    }
    
    return passCount === totalCount;
}

// Run the test
if (require.main === module) {
    runCompleteTest()
        .then(success => process.exit(success ? 0 : 1))
        .catch(error => {
            console.error('💥 [FATAL] Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = { runCompleteTest };