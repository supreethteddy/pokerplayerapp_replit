/**
 * GOD-LEVEL CHAT FILTER BYPASS TEST
 *
 * This test verifies that:
 * 1. All messages are now visible in the Player Portal (bypass active)
 * 2. Field/type mismatches are logged in detail
 * 3. Cross-portal messages appear in real-time
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.STAFF_PORTAL_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testGodLevelFilterBypass() {
  console.log('🚨 GOD-LEVEL FILTER BYPASS TEST STARTING...');
  
  // Test 1: Send a message from Staff Portal side
  const testMessage = {
    session_id: 'test-session-bypass',
    player_id: 29, // User Vignesh's ID
    player_name: 'vignesh gana',
    message: `GOD-LEVEL BYPASS TEST: This message should appear in Player Portal with ALL field/type combinations logged. Timestamp: ${new Date().toISOString()}`,
    sender: 'gre',
    sender_name: 'Filter Bypass Test Agent',
    timestamp: new Date().toISOString(),
    status: 'sent'
  };

  console.log('📤 INSERTING TEST MESSAGE:', testMessage);

  const { data: insertResult, error: insertError } = await supabase
    .from('gre_chat_messages')
    .insert([testMessage])
    .select();

  if (insertError) {
    console.error('❌ Insert failed:', insertError);
    return;
  }

  console.log('✅ TEST MESSAGE INSERTED:', insertResult[0]);

  // Test 2: Send message with different field variants to test filtering
  const variantTests = [
    {
      ...testMessage,
      session_id: 'variant-test-1',
      message: 'VARIANT TEST 1: player_id as string',
      player_id: '29', // String instead of number

    },
    {
      ...testMessage,
      session_id: 'variant-test-2',
      message: 'VARIANT TEST 2: playerId camelCase',
      player_id: null,
      playerId: 29, // camelCase variant

    },
    {
      ...testMessage,
      session_id: 'variant-test-3',
      message: 'VARIANT TEST 3: Different player ID should NOT match',
      player_id: 99, // Different player

    }
  ];

  for (const variant of variantTests) {
    console.log('📤 INSERTING VARIANT TEST:', variant.message);
    
    const { data, error } = await supabase
      .from('gre_chat_messages')
      .insert([variant])
      .select();

    if (error) {
      console.error('❌ Variant insert failed:', error);
    } else {
      console.log('✅ VARIANT INSERTED:', data[0]?.message);
    }
  }

  console.log('🎯 TEST COMPLETE - Check Player Portal console for:');
  console.log('1. 🚨 GOD-LEVEL FILTER BYPASS ACTIVE - SHOWING ALL MESSAGES');
  console.log('2. [FILTER-TEST] logs showing field/type combinations');
  console.log('3. Messages with debug metadata showing player ID matches');
  console.log('4. All variant messages should be visible (including wrong player ID)');
  
  console.log('\n🔍 EXPECTED BEHAVIOR:');
  console.log('- ALL messages should appear in Player Portal chat');
  console.log('- Console should show detailed field/type analysis');
  console.log('- Debug metadata should show which messages match current user');
  console.log('- Filter bypass should reveal any hidden messages');
}

testGodLevelFilterBypass().catch(console.error);