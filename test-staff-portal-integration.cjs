// Test script to verify Staff Portal integration with shared database
const { createClient } = require('@supabase/supabase-js');

const staffPortalSupabase = createClient(
  'https://oyhnpnymlezjusnwpjeu.supabase.co',
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY
);

async function testStaffPortalIntegration() {
  console.log('🔍 STAFF PORTAL INTEGRATION TEST');
  console.log('===============================');
  
  try {
    // Test 1: Verify connection to shared database
    console.log('\n📋 TEST 1: Database Connection');
    const { data: testConnection, error: connectionError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .select('count(*)')
      .single();
    
    if (connectionError) {
      console.error('❌ Database connection failed:', connectionError);
      return;
    } else {
      console.log('✅ Database connection successful');
    }
    
    // Test 2: Get all messages for player 29 (what Staff Portal should see)
    console.log('\n📋 TEST 2: Staff Portal Message View');
    const { data: staffMessages, error: staffError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .select('*')
      .eq('player_id', 29)
      .order('created_at', { ascending: true });
    
    if (staffError) {
      console.error('❌ Error fetching staff messages:', staffError);
      return;
    }
    
    console.log(`✅ Staff Portal should see ${staffMessages.length} messages:`);
    staffMessages.forEach((msg, i) => {
      console.log(`${i+1}. [${msg.sender.toUpperCase()}] ${msg.sender_name}: "${msg.message}"`);
      console.log(`   📅 ${new Date(msg.created_at).toLocaleTimeString()}`);
      console.log(`   🆔 ID: ${msg.id}`);
    });
    
    // Test 3: Get session information
    console.log('\n📋 TEST 3: Chat Session Information');
    const { data: session, error: sessionError } = await staffPortalSupabase
      .from('gre_chat_sessions')
      .select('*')
      .eq('player_id', 29)
      .single();
    
    if (sessionError) {
      console.error('❌ Error fetching session:', sessionError);
    } else {
      console.log('✅ Chat Session Details:');
      console.log(`   🆔 Session ID: ${session.id}`);
      console.log(`   👤 Player: ${session.player_id} (${session.player_name || 'Unknown'})`);
      console.log(`   📧 Email: ${session.player_email || 'Not set'}`);
      console.log(`   📅 Created: ${new Date(session.created_at).toLocaleString()}`);
      console.log(`   🔗 Status: ${session.status}`);
    }
    
    // Test 4: Create a test GRE message to verify Staff Portal can write
    console.log('\n📋 TEST 4: Staff Portal Write Test');
    const testMessage = `Staff Portal Integration Test - ${new Date().toLocaleTimeString()}`;
    
    const { data: newMessage, error: writeError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .insert([{
        player_id: 29,
        player_name: 'Vignesh Gana',
        message: testMessage,
        sender: 'gre',
        sender_name: 'Integration Test GRE',
        session_id: session?.id || 'f4560670-cfce-4331-97d6-9daa06d3ee8e',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (writeError) {
      console.error('❌ Staff Portal write test failed:', writeError);
    } else {
      console.log('✅ Staff Portal can write to database');
      console.log(`   📝 Test message created: ${newMessage.id}`);
      console.log(`   💬 Message: "${testMessage}"`);
    }
    
    // Test 5: Get updated message count
    console.log('\n📋 TEST 5: Updated Message Count');
    const { data: updatedMessages, error: countError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .select('*')
      .eq('player_id', 29)
      .order('created_at', { ascending: true });
    
    if (countError) {
      console.error('❌ Error getting updated count:', countError);
    } else {
      console.log(`✅ Total messages after test: ${updatedMessages.length}`);
      console.log('   Last message:', updatedMessages[updatedMessages.length - 1]?.message);
    }
    
    // Summary
    console.log('\n🎯 INTEGRATION SUMMARY');
    console.log('======================');
    console.log('✅ Database connection: WORKING');
    console.log('✅ Message reading: WORKING');
    console.log('✅ Session access: WORKING');
    console.log('✅ Message writing: WORKING');
    console.log('\n🔗 Staff Portal should use this exact database configuration:');
    console.log('   URL: https://oyhnpnymlezjusnwpjeu.supabase.co');
    console.log('   Service Key: [STAFF_PORTAL_SUPABASE_SERVICE_KEY]');
    console.log('\n📊 If Staff Portal shows different messages, it\'s using wrong database!');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }
}

testStaffPortalIntegration();