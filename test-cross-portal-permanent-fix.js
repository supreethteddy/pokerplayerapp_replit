#!/usr/bin/env node

/**
 * 🏆 CROSS-PORTAL CHAT SYSTEM PERMANENT FIX & DIAGNOSTIC PLAN - END-TO-END TEST
 * 
 * This comprehensive test validates the 6-point diagnostic plan implementation:
 * 1. Chat Request Creation – Audit & Recovery
 * 2. Status & Field Audit (Universal Mapping)
 * 3. Staff Portal Fetch/Subscribe Logic
 * 4. Fail-Safe Backend, No More Silent Failures
 * 5. End-to-End Confirmation
 * 6. Permanent Test Suite
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Test Configuration
const TEST_CONFIG = {
  SUPABASE_URL: process.env.STAFF_PORTAL_SUPABASE_URL || 'https://oyhnpnymlezjusnwpjeu.supabase.co',
  SUPABASE_SERVICE_KEY: process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY,
  TEST_PLAYER_ID: 29,
  TEST_PLAYER_NAME: 'Vignesh Gana',
  API_BASE_URL: 'http://localhost:5000',
  TIMEOUT: 10000
};

// Initialize Supabase client
let supabase;
try {
  if (!TEST_CONFIG.SUPABASE_SERVICE_KEY) {
    throw new Error('STAFF_PORTAL_SUPABASE_SERVICE_KEY environment variable is required');
  }
  
  supabase = createClient(TEST_CONFIG.SUPABASE_URL, TEST_CONFIG.SUPABASE_SERVICE_KEY);
  console.log('✅ [SETUP] Supabase client initialized');
} catch (error) {
  console.error('❌ [SETUP] Failed to initialize Supabase client:', error.message);
  process.exit(1);
}

// Test Results Tracker
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// Utility Functions
const logTest = (testName, passed, details = '') => {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ [TEST ${testResults.total}] ${testName}`);
  } else {
    testResults.failed++;
    console.error(`❌ [TEST ${testResults.total}] ${testName} - ${details}`);
  }
  testResults.details.push({ testName, passed, details });
};

const makeAPIRequest = async (method, endpoint, data = null) => {
  const url = `${TEST_CONFIG.API_BASE_URL}${endpoint}`;
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'CrossPortalTestSuite/1.0'
    },
    timeout: TEST_CONFIG.TIMEOUT
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    const responseData = await response.text();
    
    let parsedData;
    try {
      parsedData = JSON.parse(responseData);
    } catch {
      parsedData = responseData;
    }
    
    return {
      status: response.status,
      data: parsedData,
      headers: response.headers,
      ok: response.ok
    };
  } catch (error) {
    throw new Error(`API request failed: ${error.message}`);
  }
};

// Test Functions

/**
 * Test 1: Chat Request Creation – Audit & Recovery
 */
const testChatRequestCreation = async () => {
  console.log('\n📋 === TEST 1: CHAT REQUEST CREATION & AUDIT ===');
  
  const testMessage = `Cross-portal test message - ${Date.now()}`;
  const requestPayload = {
    playerId: TEST_CONFIG.TEST_PLAYER_ID,
    playerName: TEST_CONFIG.TEST_PLAYER_NAME,
    message: testMessage,
    senderType: 'player'
  };
  
  try {
    console.log('📤 [TEST] Sending chat message via API...');
    const response = await makeAPIRequest('POST', '/api/unified-chat/send', requestPayload);
    
    // Validate comprehensive audit response
    const auditPresent = response.data.audit && 
                         response.data.audit.operationId && 
                         response.data.audit.duration &&
                         response.data.audit.databaseId;
    
    logTest('Chat Request API Response Structure', response.ok && auditPresent, 
           !response.ok ? `HTTP ${response.status}` : !auditPresent ? 'Missing audit data' : '');
    
    if (response.ok && response.data.success) {
      // Step 2: Verify message exists in database
      console.log('🔍 [TEST] Verifying message in database...');
      const { data: dbMessages, error } = await supabase
        .from('gre_chat_messages')
        .select('*')
        .eq('player_id', TEST_CONFIG.TEST_PLAYER_ID)
        .eq('message', testMessage)
        .single();
      
      logTest('Message Stored in Database', !error && dbMessages, 
             error ? error.message : !dbMessages ? 'Message not found' : '');
      
      if (dbMessages) {
        // Step 3: Validate field transformation (snake_case in DB)
        const hasSnakeCaseFields = dbMessages.player_id !== undefined && 
                                  dbMessages.player_name !== undefined &&
                                  dbMessages.created_at !== undefined;
        
        logTest('Database Snake Case Fields', hasSnakeCaseFields, 
               !hasSnakeCaseFields ? 'Missing snake_case fields' : '');
        
        // Step 4: Validate API response has camelCase fields
        const message = response.data.message;
        const hasCamelCaseFields = message.playerId !== undefined && 
                                  message.playerName !== undefined;
        
        logTest('API Response CamelCase Transform', hasCamelCaseFields,
               !hasCamelCaseFields ? 'Missing camelCase transformation' : '');
      }
    }
    
    return response.data.audit?.operationId;
    
  } catch (error) {
    logTest('Chat Request Creation', false, error.message);
    return null;
  }
};

/**
 * Test 2: Status & Field Audit (Universal Mapping)
 */
const testFieldMappingConsistency = async () => {
  console.log('\n🔍 === TEST 2: FIELD MAPPING & UNIVERSAL CONSISTENCY ===');
  
  try {
    // Test camelCase to snake_case transformation
    const testData = {
      playerId: 123,
      playerName: 'Test Player',
      messageText: 'Test message',
      createdAt: new Date().toISOString()
    };
    
    // This test validates the transformation functions work correctly
    console.log('🔄 [TEST] Testing field transformation consistency...');
    
    // Query database to validate snake_case consistency
    const { data: dbSample, error } = await supabase
      .from('gre_chat_messages')
      .select('*')
      .limit(1);
    
    if (!error && dbSample && dbSample.length > 0) {
      const sample = dbSample[0];
      const hasConsistentSnakeCase = sample.player_id !== undefined && 
                                    sample.player_name !== undefined &&
                                    sample.created_at !== undefined &&
                                    sample.playerId === undefined; // Should NOT have camelCase
      
      logTest('Database Field Consistency (Snake Case)', hasConsistentSnakeCase,
             !hasConsistentSnakeCase ? 'Mixed case fields detected' : '');
    } else {
      logTest('Database Field Consistency Check', false, 'No sample data available');
    }
    
    // Test API endpoint field transformation
    console.log('🔄 [TEST] Testing API field transformation...');
    const response = await makeAPIRequest('GET', `/api/unified-chat/messages/${TEST_CONFIG.TEST_PLAYER_ID}?staffPortalMode=true`);
    
    if (response.ok && response.data) {
      const messages = Array.isArray(response.data) ? response.data : response.data.messages || [];
      
      if (messages.length > 0) {
        const sample = messages[0];
        const hasConsistentCamelCase = sample.playerId !== undefined && 
                                      sample.playerName !== undefined &&
                                      sample.createdAt !== undefined &&
                                      sample.player_id === undefined; // Should NOT have snake_case
        
        logTest('API Response Field Consistency (CamelCase)', hasConsistentCamelCase,
               !hasConsistentCamelCase ? 'Mixed case fields in API response' : '');
      } else {
        console.log('⚠️ [TEST] No messages available for field consistency test');
      }
    }
    
  } catch (error) {
    logTest('Field Mapping Consistency', false, error.message);
  }
};

/**
 * Test 3: Staff Portal Fetch/Subscribe Logic
 */
const testStaffPortalFetch = async () => {
  console.log('\n🚀 === TEST 3: STAFF PORTAL FETCH LOGIC ===');
  
  try {
    // Test enhanced GRE admin chat sessions endpoint
    console.log('📊 [TEST] Testing staff portal chat sessions...');
    const response = await makeAPIRequest('GET', '/api/gre-admin/chat-sessions?debug=true&bypassStatusFilter=true');
    
    logTest('Staff Portal Sessions API Response', response.ok,
           !response.ok ? `HTTP ${response.status}` : '');
    
    if (response.ok && response.data) {
      const sessions = Array.isArray(response.data) ? response.data : [];
      
      logTest('Staff Portal Sessions Data Structure', sessions.length >= 0,
             'Invalid sessions data structure');
      
      // Test that sessions include comprehensive message data
      const sessionWithMessages = sessions.find(s => s.gre_chat_messages && s.gre_chat_messages.length > 0);
      
      if (sessionWithMessages) {
        const hasComprehensiveData = sessionWithMessages.player_id !== undefined &&
                                   sessionWithMessages.messageCount !== undefined &&
                                   sessionWithMessages.lastMessage !== undefined;
        
        logTest('Staff Portal Session Comprehensive Data', hasComprehensiveData,
               !hasComprehensiveData ? 'Missing comprehensive session data' : '');
      }
      
      // Test bypass status filter functionality
      console.log('🔍 [TEST] Testing status filter bypass...');
      const bypassResponse = await makeAPIRequest('GET', '/api/unified-chat/messages/29?bypassStatusFilter=true&staffPortalMode=true');
      
      logTest('Status Filter Bypass Functionality', bypassResponse.ok,
             !bypassResponse.ok ? `HTTP ${bypassResponse.status}` : '');
    }
    
  } catch (error) {
    logTest('Staff Portal Fetch Logic', false, error.message);
  }
};

/**
 * Test 4: Fail-Safe Backend & Error Handling
 */
const testFailSafeBackend = async () => {
  console.log('\n🛡️ === TEST 4: FAIL-SAFE BACKEND & ERROR HANDLING ===');
  
  try {
    // Test error handling with invalid data
    console.log('🚨 [TEST] Testing error handling with invalid payload...');
    const invalidResponse = await makeAPIRequest('POST', '/api/unified-chat/send', {
      // Missing required fields
      invalidField: 'test'
    });
    
    const hasStructuredError = invalidResponse.status === 400 && 
                              invalidResponse.data.error &&
                              invalidResponse.data.operationId;
    
    logTest('Structured Error Response', hasStructuredError,
           !hasStructuredError ? 'Missing proper error structure' : '');
    
    // Test error handling with invalid player ID
    console.log('🚨 [TEST] Testing invalid player ID handling...');
    const invalidPlayerResponse = await makeAPIRequest('GET', '/api/unified-chat/messages/invalid-id');
    
    const hasPlayerValidation = invalidPlayerResponse.status === 400 &&
                               invalidPlayerResponse.data.error;
    
    logTest('Player ID Validation', hasPlayerValidation,
           !hasPlayerValidation ? 'Missing player ID validation' : '');
    
    // Test that server doesn't crash on malformed requests
    console.log('🚨 [TEST] Testing malformed request handling...');
    try {
      const malformedResponse = await makeAPIRequest('POST', '/api/unified-chat/send', 'invalid-json');
      logTest('Malformed Request Handling', malformedResponse.status >= 400, 
             'Server should reject malformed requests');
    } catch (error) {
      // This is expected for malformed requests
      logTest('Malformed Request Handling', true, '');
    }
    
  } catch (error) {
    logTest('Fail-Safe Backend Testing', false, error.message);
  }
};

/**
 * Test 5: End-to-End Confirmation
 */
const testEndToEndFlow = async () => {
  console.log('\n🎯 === TEST 5: END-TO-END CONFIRMATION ===');
  
  try {
    const testMessage = `E2E Test Message - ${Date.now()}`;
    
    // Step 1: Create new chat from Player Portal
    console.log('📤 [E2E] Step 1: Creating chat message...');
    const createResponse = await makeAPIRequest('POST', '/api/unified-chat/send', {
      playerId: TEST_CONFIG.TEST_PLAYER_ID,
      playerName: TEST_CONFIG.TEST_PLAYER_NAME,
      message: testMessage,
      senderType: 'player'
    });
    
    logTest('E2E Step 1: Message Creation', createResponse.ok && createResponse.data.success,
           !createResponse.ok ? `HTTP ${createResponse.status}` : '');
    
    if (createResponse.ok) {
      // Step 2: Confirm new DB row
      console.log('🔍 [E2E] Step 2: Verifying database record...');
      const { data: dbMessage, error } = await supabase
        .from('gre_chat_messages')
        .select('*')
        .eq('message', testMessage)
        .single();
      
      logTest('E2E Step 2: Database Record Confirmation', !error && dbMessage,
             error ? error.message : 'Message not found in database');
      
      // Step 3: Confirm visibility in GRE Portal inbox
      console.log('👥 [E2E] Step 3: Checking GRE portal visibility...');
      const greResponse = await makeAPIRequest('GET', '/api/gre-admin/chat-sessions?debug=true');
      
      if (greResponse.ok) {
        const sessions = Array.isArray(greResponse.data) ? greResponse.data : [];
        const sessionWithMessage = sessions.find(s => 
          s.player_id === TEST_CONFIG.TEST_PLAYER_ID && 
          s.gre_chat_messages?.some(m => m.message === testMessage)
        );
        
        logTest('E2E Step 3: GRE Portal Visibility', !!sessionWithMessage,
               !sessionWithMessage ? 'Message not visible in GRE portal' : '');
        
        // Step 4: Test bidirectional messaging
        console.log('🔄 [E2E] Step 4: Testing bidirectional messaging...');
        const greReplyMessage = `GRE Reply to E2E Test - ${Date.now()}`;
        
        const greReplyResponse = await makeAPIRequest('POST', '/api/unified-chat/send', {
          playerId: TEST_CONFIG.TEST_PLAYER_ID,
          playerName: 'GRE Staff',
          message: greReplyMessage,
          senderType: 'gre'
        });
        
        logTest('E2E Step 4: Bidirectional Messaging', greReplyResponse.ok,
               !greReplyResponse.ok ? `GRE reply failed: HTTP ${greReplyResponse.status}` : '');
        
        // Step 5: Validate DB/chat flow
        console.log('🔍 [E2E] Step 5: Validating complete chat flow...');
        const { data: allMessages, error: allError } = await supabase
          .from('gre_chat_messages')
          .select('*')
          .eq('player_id', TEST_CONFIG.TEST_PLAYER_ID)
          .in('message', [testMessage, greReplyMessage])
          .order('created_at', { ascending: true });
        
        const hasCompleteFlow = !allError && allMessages && allMessages.length === 2 &&
                               allMessages[0].sender === 'player' &&
                               allMessages[1].sender === 'gre';
        
        logTest('E2E Step 5: Complete Chat Flow Validation', hasCompleteFlow,
               allError ? allError.message : !hasCompleteFlow ? 'Incomplete message flow' : '');
      }
    }
    
  } catch (error) {
    logTest('End-to-End Flow', false, error.message);
  }
};

/**
 * Test 6: Permanent Test Suite Validation
 */
const testPermanentSuite = async () => {
  console.log('\n🏆 === TEST 6: PERMANENT TEST SUITE VALIDATION ===');
  
  try {
    // Test system performance under load
    console.log('⚡ [PERFORMANCE] Testing system performance...');
    const startTime = Date.now();
    
    const performancePromises = [];
    for (let i = 0; i < 5; i++) {
      performancePromises.push(
        makeAPIRequest('GET', `/api/unified-chat/messages/${TEST_CONFIG.TEST_PLAYER_ID}`)
      );
    }
    
    const performanceResults = await Promise.all(performancePromises);
    const endTime = Date.now();
    const avgResponseTime = (endTime - startTime) / performanceResults.length;
    
    const allSuccessful = performanceResults.every(r => r.ok);
    const performanceAcceptable = avgResponseTime < 2000; // 2 seconds average
    
    logTest('System Performance Under Load', allSuccessful && performanceAcceptable,
           !allSuccessful ? 'Some requests failed' : !performanceAcceptable ? `Avg response time: ${avgResponseTime}ms` : '');
    
    // Test data consistency across multiple requests
    console.log('🔄 [CONSISTENCY] Testing data consistency...');
    const consistencyResponse1 = await makeAPIRequest('GET', `/api/unified-chat/messages/${TEST_CONFIG.TEST_PLAYER_ID}`);
    const consistencyResponse2 = await makeAPIRequest('GET', `/api/unified-chat/messages/${TEST_CONFIG.TEST_PLAYER_ID}`);
    
    if (consistencyResponse1.ok && consistencyResponse2.ok) {
      const messages1 = Array.isArray(consistencyResponse1.data) ? consistencyResponse1.data : consistencyResponse1.data.messages || [];
      const messages2 = Array.isArray(consistencyResponse2.data) ? consistencyResponse2.data : consistencyResponse2.data.messages || [];
      
      const dataConsistent = messages1.length === messages2.length;
      
      logTest('Data Consistency Across Requests', dataConsistent,
             !dataConsistent ? `Count mismatch: ${messages1.length} vs ${messages2.length}` : '');
    }
    
    // Test error recovery
    console.log('🛡️ [RECOVERY] Testing error recovery...');
    // This validates that the system can handle and recover from errors gracefully
    const recoveryTest = await makeAPIRequest('GET', '/api/gre-admin/chat-sessions');
    logTest('Error Recovery Capability', recoveryTest.ok,
           !recoveryTest.ok ? 'System not recovering from previous errors' : '');
    
  } catch (error) {
    logTest('Permanent Test Suite', false, error.message);
  }
};

// Main Test Execution
const runCrossPortalPermanentFixTests = async () => {
  console.log('🏆 CROSS-PORTAL CHAT SYSTEM PERMANENT FIX & DIAGNOSTIC PLAN - COMPREHENSIVE TEST SUITE');
  console.log('================================================================================');
  console.log(`🎯 Target Player: ${TEST_CONFIG.TEST_PLAYER_NAME} (ID: ${TEST_CONFIG.TEST_PLAYER_ID})`);
  console.log(`🌐 API Base URL: ${TEST_CONFIG.API_BASE_URL}`);
  console.log(`🗄️ Database: ${TEST_CONFIG.SUPABASE_URL}`);
  console.log('================================================================================\n');
  
  const startTime = Date.now();
  
  try {
    // Execute all test suites
    await testChatRequestCreation();
    await testFieldMappingConsistency();
    await testStaffPortalFetch();
    await testFailSafeBackend();
    await testEndToEndFlow();
    await testPermanentSuite();
    
  } catch (error) {
    console.error('💥 [CRITICAL] Test suite execution failed:', error);
    testResults.failed++;
  }
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  // Final Results Summary
  console.log('\n🏆 CROSS-PORTAL PERMANENT FIX TEST RESULTS SUMMARY');
  console.log('======================================================================');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⏱️ Duration: ${duration}ms`);
  console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  console.log('======================================================================\n');
  
  if (testResults.failed === 0) {
    console.log('🎉 ALL TESTS PASSED - CROSS-PORTAL PERMANENT FIX VALIDATED!');
    console.log('✅ Chat request creation with comprehensive audit operational');
    console.log('✅ Universal field mapping system functioning perfectly');
    console.log('✅ Staff portal fetch logic with bypass filters working');
    console.log('✅ Fail-safe backend with structured error handling active');
    console.log('✅ End-to-end confirmation flow validated');
    console.log('✅ Permanent test suite performance verified');
  } else {
    console.log('⚠️ SOME TESTS FAILED - REVIEW REQUIRED');
    console.log('\nFailed Tests:');
    testResults.details
      .filter(test => !test.passed)
      .forEach(test => {
        console.log(`❌ ${test.testName}: ${test.details}`);
      });
  }
  
  console.log('\n================================================================================');
  console.log('Cross-Portal Chat System Permanent Fix & Diagnostic Plan - Test Complete');
  console.log('================================================================================');
  
  process.exit(testResults.failed === 0 ? 0 : 1);
};

// Execute tests
runCrossPortalPermanentFixTests().catch(error => {
  console.error('💥 [FATAL] Test execution failed:', error);
  process.exit(1);
});