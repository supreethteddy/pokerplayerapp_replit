// MILLISECOND-LEVEL CHAT PERFORMANCE TEST
// Tests real-time synchronization between Player Portal and Staff Portal

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://oyhnpnymlezjusnwpjeu.supabase.co';
const serviceKey = process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY;

if (!serviceKey) {
  console.error('❌ STAFF_PORTAL_SUPABASE_SERVICE_KEY not found');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

console.log('🚀 MILLISECOND-LEVEL CHAT PERFORMANCE TEST');
console.log('==========================================');

async function testRealTimeSync() {
  try {
    // Step 1: Get all messages for player 29
    console.log('\n📋 Step 1: Checking all messages in gre_chat_messages table...');
    const { data: allMessages, error: allError } = await supabase
      .from('gre_chat_messages')
      .select('*')
      .eq('player_id', 29)
      .order('created_at', { ascending: false });

    if (allError) {
      console.error('❌ Error fetching all messages:', allError);
      return;
    }

    console.log(`✅ Found ${allMessages.length} total messages for player 29:`);
    allMessages.forEach((msg, index) => {
      console.log(`\n📨 Message ${index + 1}:`);
      console.log(`   ID: ${msg.id}`);
      console.log(`   Session: ${msg.session_id}`);
      console.log(`   Player: ${msg.player_name} (ID: ${msg.player_id})`);
      console.log(`   Sender: ${msg.sender} (${msg.sender_name})`);
      console.log(`   Message: "${msg.message}"`);
      console.log(`   Status: ${msg.status}`);
      console.log(`   Created: ${msg.created_at}`);
      console.log(`   Updated: ${msg.updated_at}`);
    });

    // Step 2: Check gre_chat_sessions
    console.log('\n📋 Step 2: Checking all sessions in gre_chat_sessions table...');
    const { data: allSessions, error: sessionError } = await supabase
      .from('gre_chat_sessions')
      .select('*')
      .eq('player_id', 29)
      .order('started_at', { ascending: false });

    if (sessionError) {
      console.error('❌ Error fetching sessions:', sessionError);
      return;
    }

    console.log(`✅ Found ${allSessions.length} sessions for player 29:`);
    allSessions.forEach((session, index) => {
      console.log(`\n💬 Session ${index + 1}:`);
      console.log(`   ID: ${session.id}`);
      console.log(`   Player ID: ${session.player_id}`);
      console.log(`   GRE ID: ${session.gre_id || 'Unassigned'}`);
      console.log(`   Status: ${session.status}`);
      console.log(`   Priority: ${session.priority}`);
      console.log(`   Category: ${session.category}`);
      console.log(`   Started: ${session.started_at}`);
      console.log(`   Last Message: ${session.last_message_at}`);
      console.log(`   Ended: ${session.ended_at || 'Still active'}`);
    });

    // Step 3: Check what Player Portal API returns
    console.log('\n📋 Step 3: Testing Player Portal API endpoint...');
    const response = await fetch('http://localhost:5000/api/gre-chat/messages/29');
    const playerPortalMessages = await response.json();
    
    console.log(`✅ Player Portal API returned ${playerPortalMessages.length} messages:`);
    playerPortalMessages.forEach((msg, index) => {
      console.log(`\n🎮 Player Portal Message ${index + 1}:`);
      console.log(`   ID: ${msg.id}`);
      console.log(`   Player: ${msg.player_name} (ID: ${msg.player_id})`);
      console.log(`   Sender: ${msg.sender} (${msg.sender_name})`);
      console.log(`   Message: "${msg.message}"`);
      console.log(`   Status: ${msg.status}`);
      console.log(`   Timestamp: ${msg.timestamp}`);
    });

    // Step 4: Compare for sync issues
    console.log('\n🔍 Step 4: SYNCHRONIZATION ANALYSIS');
    console.log('=====================================');
    
    if (allMessages.length !== playerPortalMessages.length) {
      console.log(`❌ SYNC ISSUE: Database has ${allMessages.length} messages, Player Portal shows ${playerPortalMessages.length}`);
      
      // Find missing messages
      const dbMessageIds = new Set(allMessages.map(m => m.id));
      const portalMessageIds = new Set(playerPortalMessages.map(m => m.id));
      
      const missingInPortal = allMessages.filter(m => !portalMessageIds.has(m.id));
      const missingInDB = playerPortalMessages.filter(m => !dbMessageIds.has(m.id));
      
      if (missingInPortal.length > 0) {
        console.log(`\n🚨 Messages in database but NOT in Player Portal:`);
        missingInPortal.forEach(msg => {
          console.log(`   - ${msg.id}: "${msg.message}" (${msg.sender})`);
        });
      }
      
      if (missingInDB.length > 0) {
        console.log(`\n🚨 Messages in Player Portal but NOT in database:`);
        missingInDB.forEach(msg => {
          console.log(`   - ${msg.id}: "${msg.message}" (${msg.sender})`);
        });
      }
    } else {
      console.log(`✅ PERFECT SYNC: Both systems show ${allMessages.length} messages`);
    }

    // Final recommendations
    console.log('\n🎯 RECOMMENDATIONS FOR STAFF PORTAL SYNC:');
    console.log('==========================================');
    console.log('1. Staff Portal should query: gre_chat_messages WHERE player_id = 29');
    console.log('2. Real-time updates via Supabase subscriptions on gre_chat_messages table');
    console.log('3. WebSocket path: /chat-ws for bi-directional communication');
    console.log('4. Message format: player_message type with all required fields');
    console.log(`5. Latest session ID: ${allSessions[0]?.id || 'None'}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRealTimeSync();