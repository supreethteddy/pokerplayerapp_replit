// ULTRA-FAST CHAT SYSTEM PERFORMANCE TEST
// Tests bidirectional chat with millisecond precision timing

const { createClient } = require('@supabase/supabase-js');

// Staff Portal Supabase configuration
const staffPortalSupabase = createClient(
  'https://oyhnpnymlezjusnwpjeu.supabase.co',
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY
);

console.log('🚀 MILLISECOND CHAT PERFORMANCE TEST');
console.log('===================================');

async function testChatPerformance() {
  try {
    const playerId = 29;
    const playerName = 'vignesh gana';
    
    console.log(`\n🧪 Testing chat for player ${playerId} (${playerName})`);
    
    // Step 1: Clear any existing messages
    console.log('\n🧹 Clearing existing messages...');
    const { error: deleteError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .delete()
      .eq('player_id', playerId);
    
    if (deleteError) {
      console.error('❌ Error clearing messages:', deleteError);
    } else {
      console.log('✅ Messages cleared successfully');
    }
    
    // Step 2: Verify clean state
    console.log('\n🔍 Verifying clean state...');
    const { data: cleanCheck, error: cleanError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .select('*')
      .eq('player_id', playerId);
    
    console.log(`📊 Messages in database: ${cleanCheck?.length || 0}`);
    
    // Step 3: Send player message with timing
    console.log('\n📤 Sending player message...');
    const startTime = Date.now();
    
    const { data: playerMessage, error: playerError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .insert([{
        player_id: playerId,
        player_name: playerName,
        message: 'LIVE TEST: This is a real-time test message',
        sender: 'player',
        sender_name: playerName,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    const playerTime = Date.now() - startTime;
    
    if (playerError) {
      console.error('❌ Error sending player message:', playerError);
      return;
    }
    
    console.log(`✅ Player message sent in ${playerTime}ms`);
    console.log(`📝 Message ID: ${playerMessage.id}`);
    
    // Step 4: Send GRE response with timing
    console.log('\n📥 Sending GRE response...');
    const greStartTime = Date.now();
    
    const { data: greMessage, error: greError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .insert([{
        player_id: playerId,
        player_name: playerName,
        message: 'LIVE GRE RESPONSE: Hello! I received your test message. This is a real Staff Portal response.',
        sender: 'gre',
        sender_name: 'Guest Relations Executive',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    const greTime = Date.now() - greStartTime;
    
    if (greError) {
      console.error('❌ Error sending GRE message:', greError);
      return;
    }
    
    console.log(`✅ GRE response sent in ${greTime}ms`);
    console.log(`📝 Response ID: ${greMessage.id}`);
    
    // Step 5: Verify complete conversation
    console.log('\n📋 Verifying complete conversation...');
    const { data: allMessages, error: fetchError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: true });
    
    if (fetchError) {
      console.error('❌ Error fetching messages:', fetchError);
      return;
    }
    
    console.log(`✅ Total messages in conversation: ${allMessages.length}`);
    
    allMessages.forEach((msg, index) => {
      console.log(`${index + 1}. [${msg.sender.toUpperCase()}] ${msg.sender_name}: "${msg.message}"`);
    });
    
    // Step 6: Performance summary
    console.log('\n⚡ PERFORMANCE SUMMARY');
    console.log('=====================');
    console.log(`Player message latency: ${playerTime}ms`);
    console.log(`GRE response latency: ${greTime}ms`);
    console.log(`Total round-trip time: ${playerTime + greTime}ms`);
    console.log(`Average message latency: ${(playerTime + greTime) / 2}ms`);
    
    if (playerTime < 100 && greTime < 100) {
      console.log('🏆 EXCELLENT: Sub-100ms performance achieved!');
    } else if (playerTime < 500 && greTime < 500) {
      console.log('✅ GOOD: Sub-500ms performance achieved');
    } else {
      console.log('⚠️  SLOW: Performance optimization needed');
    }
    
    console.log('\n🎯 LIVE CHAT SYSTEM READY FOR MANUAL TESTING');
    console.log('The system now contains authentic test messages that can be verified manually.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testChatPerformance();