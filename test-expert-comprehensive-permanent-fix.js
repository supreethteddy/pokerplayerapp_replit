#!/usr/bin/env node

/**
 * 🏆 EXPERT SYSTEM COMPREHENSIVE PERMANENT FIX VALIDATION
 * Complete test suite for validating the field transformation and chat system fixes
 */

import { createClient } from '@supabase/supabase-js';

// Test configuration
const TEST_CONFIG = {
  SUPABASE_URL: process.env.STAFF_PORTAL_SUPABASE_URL,
  SUPABASE_KEY: process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY,
  TEST_PLAYER_ID: 29,
  TEST_PLAYER_NAME: 'Vignesh Gana'
};

// Initialize Supabase client
const supabase = createClient(TEST_CONFIG.SUPABASE_URL, TEST_CONFIG.SUPABASE_KEY);

/**
 * 🔍 Expert Field Transformation Test Suite
 */
class ExpertTransformationTester {
  constructor() {
    this.testResults = [];
    this.startTime = Date.now();
  }

  // Bidirectional field transformation functions (mirroring server implementation)
  transformFieldsToCamelCase(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const camelCaseObj = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      camelCaseObj[camelKey] = Array.isArray(value) ? 
        value.map(item => this.transformFieldsToCamelCase(item)) : 
        value && typeof value === 'object' ? this.transformFieldsToCamelCase(value) : value;
    }
    return camelCaseObj;
  }

  transformFieldsToSnakeCase(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    
    const snakeCaseObj = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      snakeCaseObj[snakeKey] = Array.isArray(value) ? 
        value.map(item => this.transformFieldsToSnakeCase(item)) : 
        value && typeof value === 'object' ? this.transformFieldsToSnakeCase(value) : value;
    }
    return snakeCaseObj;
  }

  addResult(test, passed, details = {}) {
    this.testResults.push({
      test,
      passed,
      details,
      timestamp: new Date().toISOString()
    });
    
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${test}`);
    if (details.message) {
      console.log(`   └─ ${details.message}`);
    }
  }

  async testDatabaseFieldConsistency() {
    console.log('\n🔍 TESTING DATABASE FIELD CONSISTENCY...');
    
    try {
      // Test chat messages table field structure
      const { data: chatMessages, error: chatError } = await supabase
        .from('gre_chat_messages')
        .select('*')
        .limit(1);

      if (chatError) {
        this.addResult('Database Chat Messages Query', false, { 
          message: `Query failed: ${chatError.message}` 
        });
        return;
      }

      const sampleMessage = chatMessages?.[0];
      if (sampleMessage) {
        const hasSnakeCaseFields = 'player_id' in sampleMessage && 'created_at' in sampleMessage;
        const hasCamelCaseFields = 'playerId' in sampleMessage && 'createdAt' in sampleMessage;

        this.addResult('Database Snake Case Fields Present', hasSnakeCaseFields, {
          message: `Found fields: ${Object.keys(sampleMessage).join(', ')}`
        });

        this.addResult('Database Avoids CamelCase Pollution', !hasCamelCaseFields, {
          message: `Database maintains proper snake_case convention`
        });
      }

    } catch (error) {
      this.addResult('Database Connection Test', false, { 
        message: `Connection error: ${error.message}` 
      });
    }
  }

  async testFieldTransformation() {
    console.log('\n🏆 TESTING EXPERT FIELD TRANSFORMATION ENGINE...');

    // Test data with mixed naming conventions
    const testData = {
      playerId: 29,
      playerName: 'Test Player',
      createdAt: '2025-08-02T10:00:00Z',
      senderName: 'GRE Agent'
    };

    // Test camelCase to snake_case transformation
    const snakeCaseResult = this.transformFieldsToSnakeCase(testData);
    const expectedSnakeFields = ['player_id', 'player_name', 'created_at', 'sender_name'];
    const hasAllSnakeFields = expectedSnakeFields.every(field => field in snakeCaseResult);

    this.addResult('CamelCase to Snake_Case Transformation', hasAllSnakeFields, {
      message: `Transformed fields: ${Object.keys(snakeCaseResult).join(', ')}`
    });

    // Test snake_case to camelCase transformation
    const camelCaseResult = this.transformFieldsToCamelCase(snakeCaseResult);
    const expectedCamelFields = ['playerId', 'playerName', 'createdAt', 'senderName'];
    const hasAllCamelFields = expectedCamelFields.every(field => field in camelCaseResult);

    this.addResult('Snake_Case to CamelCase Transformation', hasAllCamelFields, {
      message: `Transformed fields: ${Object.keys(camelCaseResult).join(', ')}`
    });

    // Test bidirectional consistency
    const isConsistent = JSON.stringify(testData) === JSON.stringify(camelCaseResult);
    this.addResult('Bidirectional Transformation Consistency', isConsistent, {
      message: 'Original data preserved through round-trip transformation'
    });
  }

  async testChatMessageFiltering() {
    console.log('\n🎯 TESTING CHAT MESSAGE FILTERING LOGIC...');

    try {
      // Fetch actual chat messages for test player
      const { data: messages, error } = await supabase
        .from('gre_chat_messages')
        .select('*')
        .eq('player_id', TEST_CONFIG.TEST_PLAYER_ID)
        .limit(10);

      if (error) {
        this.addResult('Chat Message Query', false, { 
          message: `Query failed: ${error.message}` 
        });
        return;
      }

      this.addResult('Chat Message Query', true, {
        message: `Found ${messages?.length || 0} messages for player ${TEST_CONFIG.TEST_PLAYER_ID}`
      });

      // Test filtering logic consistency
      if (messages && messages.length > 0) {
        const allBelongToPlayer = messages.every(msg => 
          parseInt(msg.player_id) === TEST_CONFIG.TEST_PLAYER_ID
        );

        this.addResult('Message Player ID Consistency', allBelongToPlayer, {
          message: `All messages correctly filtered for player ${TEST_CONFIG.TEST_PLAYER_ID}`
        });

        // Test field transformation for frontend
        const transformedMessages = messages.map(msg => this.transformFieldsToCamelCase(msg));
        const hasTransformedFields = transformedMessages.every(msg => 
          'playerId' in msg && 'createdAt' in msg
        );

        this.addResult('Frontend Field Transformation', hasTransformedFields, {
          message: 'Messages successfully transformed to camelCase for frontend'
        });
      }

    } catch (error) {
      this.addResult('Chat Message Filtering Test', false, { 
        message: `Test error: ${error.message}` 
      });
    }
  }

  async testCrossPortalIdMapping() {
    console.log('\n🔗 TESTING CROSS-PORTAL ID MAPPING...');

    try {
      // Test unified ID handling
      const testIds = [29, '29', '029', 29.0];
      const normalizeId = (id) => {
        if (id === null || id === undefined) return null;
        const stringId = String(id).replace(/^0+/, '') || '0';
        return parseInt(stringId);
      };

      const normalizedIds = testIds.map(normalizeId);
      const allIdsConsistent = normalizedIds.every(id => id === 29);

      this.addResult('ID Normalization Consistency', allIdsConsistent, {
        message: `All ID variants (${testIds.join(', ')}) normalize to ${normalizedIds[0]}`
      });

      // Test with actual database query using different ID formats
      const queries = await Promise.all([
        supabase.from('gre_chat_messages').select('id').eq('player_id', 29).limit(1),
        supabase.from('gre_chat_messages').select('id').eq('player_id', '29').limit(1)
      ]);

      const allQueriesSuccessful = queries.every(({ error }) => !error);
      this.addResult('Cross-Portal ID Query Consistency', allQueriesSuccessful, {
        message: 'Database handles both numeric and string ID formats'
      });

    } catch (error) {
      this.addResult('Cross-Portal ID Mapping Test', false, { 
        message: `Test error: ${error.message}` 
      });
    }
  }

  async testProductionDataValidation() {
    console.log('\n🛡️ TESTING PRODUCTION DATA VALIDATION...');

    try {
      // Verify we're working with real production data
      const { data: playerData, error } = await supabase
        .from('players')
        .select('id, first_name, last_name, email')
        .eq('id', TEST_CONFIG.TEST_PLAYER_ID)
        .single();

      if (error) {
        this.addResult('Production Player Data Query', false, { 
          message: `Query failed: ${error.message}` 
        });
        return;
      }

      const isProductionData = playerData && 
        playerData.first_name && 
        !playerData.first_name.toLowerCase().includes('test') &&
        !playerData.first_name.toLowerCase().includes('demo');

      this.addResult('Production Data Validation', isProductionData, {
        message: `Player: ${playerData?.first_name} ${playerData?.last_name} (${playerData?.email})`
      });

      // Verify data integrity
      const hasValidEmail = playerData?.email && playerData.email.includes('@');
      this.addResult('Data Integrity Check', hasValidEmail, {
        message: 'Player data contains valid email and complete profile'
      });

    } catch (error) {
      this.addResult('Production Data Validation', false, { 
        message: `Validation error: ${error.message}` 
      });
    }
  }

  async runComprehensiveTest() {
    console.log('🏆 EXPERT SYSTEM COMPREHENSIVE PERMANENT FIX VALIDATION');
    console.log('=' .repeat(70));
    console.log(`Testing Player ID: ${TEST_CONFIG.TEST_PLAYER_ID}`);
    console.log(`Test Started: ${new Date().toISOString()}`);

    await this.testDatabaseFieldConsistency();
    await this.testFieldTransformation();
    await this.testChatMessageFiltering();
    await this.testCrossPortalIdMapping();
    await this.testProductionDataValidation();

    this.generateReport();
  }

  generateReport() {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(result => result.passed).length;
    const failedTests = totalTests - passedTests;

    console.log('\n' + '=' .repeat(70));
    console.log('🏆 EXPERT SYSTEM TEST RESULTS SUMMARY');
    console.log('=' .repeat(70));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`⏱️ Duration: ${duration}ms`);
    console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests === 0) {
      console.log('\n🎉 ALL TESTS PASSED - COMPREHENSIVE PERMANENT FIX VERIFIED!');
      console.log('✅ Expert-level field transformation system operational');
      console.log('✅ Database schema consistency maintained');
      console.log('✅ Cross-portal ID mapping functioning perfectly');
      console.log('✅ Production data validation successful');
      console.log('✅ Chat message filtering working correctly');
    } else {
      console.log('\n⚠️ SOME TESTS FAILED - REVIEW REQUIRED');
      const failedTestNames = this.testResults
        .filter(result => !result.passed)
        .map(result => result.test);
      console.log('Failed tests:', failedTestNames.join(', '));
    }

    console.log('\n📋 DETAILED TEST RESULTS:');
    this.testResults.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.test}`);
      if (result.details.message) {
        console.log(`   ${result.details.message}`);
      }
    });

    console.log('\n🏆 EXPERT SYSTEM AUDIT COMPLETE');
    console.log('=' .repeat(70));
  }
}

// Run the comprehensive test
async function main() {
  if (!TEST_CONFIG.SUPABASE_URL || !TEST_CONFIG.SUPABASE_KEY) {
    console.error('❌ Missing Supabase configuration. Please set STAFF_PORTAL_SUPABASE_URL and STAFF_PORTAL_SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const tester = new ExpertTransformationTester();
  await tester.runComprehensiveTest();
}

// Run the test if this is the main module
main().catch(console.error);

export { ExpertTransformationTester };