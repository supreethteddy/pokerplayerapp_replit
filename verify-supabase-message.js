// Direct Supabase verification script
// This checks if messages are actually stored in the Staff Portal Supabase database

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oyhnpnymlezjusnwpjeu.supabase.co';
const serviceKey = process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY;

if (!serviceKey) {
  console.error('❌ STAFF_PORTAL_SUPABASE_SERVICE_KEY not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

console.log('🔍 VERIFYING SUPABASE MESSAGE STORAGE');
console.log('====================================');

async function checkMessages() {
  try {
    // Check gre_chat_messages table
    console.log('\n📋 Checking gre_chat_messages table...');
    const { data: messages, error } = await supabase
      .from('gre_chat_messages')
      .select('*')
      .eq('player_id', 29)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error querying messages:', error);
      return;
    }

    console.log(`✅ Found ${messages.length} messages for player 29:`);
    messages.forEach((msg, index) => {
      console.log(`\n📨 Message ${index + 1}:`);
      console.log(`   ID: ${msg.id}`);
      console.log(`   Player: ${msg.player_name}`);
      console.log(`   Message: "${msg.message}"`);
      console.log(`   Sender: ${msg.sender}`);
      console.log(`   Status: ${msg.status}`);
      console.log(`   Created: ${msg.created_at}`);
    });

    // Check gre_chat_sessions table
    console.log('\n📋 Checking gre_chat_sessions table...');
    const { data: sessions, error: sessionsError } = await supabase
      .from('gre_chat_sessions')
      .select('*')
      .eq('player_id', 29)
      .order('started_at', { ascending: false })
      .limit(3);

    if (sessionsError) {
      console.error('❌ Error querying sessions:', sessionsError);
      return;
    }

    console.log(`✅ Found ${sessions.length} sessions for player 29:`);
    sessions.forEach((session, index) => {
      console.log(`\n💬 Session ${index + 1}:`);
      console.log(`   ID: ${session.id}`);
      console.log(`   Status: ${session.status}`);
      console.log(`   GRE ID: ${session.gre_id || 'Unassigned'}`);
      console.log(`   Started: ${session.started_at}`);
      console.log(`   Priority: ${session.priority}`);
    });

    // Final verification
    console.log('\n🎯 STAFF PORTAL VERIFICATION RESULTS:');
    console.log('=====================================');
    if (messages.length > 0) {
      console.log('✅ Messages are being stored in Supabase');
      console.log('✅ Staff Portal should be able to see these messages');
      console.log('📍 Latest message:', messages[0].message);
    } else {
      console.log('❌ No messages found - there may be an integration issue');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

checkMessages();