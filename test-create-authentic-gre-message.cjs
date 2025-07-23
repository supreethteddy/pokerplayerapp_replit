// Test script to create the exact message shown in Staff Portal screenshot
const { createClient } = require('@supabase/supabase-js');

const staffPortalSupabase = createClient(
  'https://oyhnpnymlezjusnwpjeu.supabase.co',
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY
);

async function createAuthenticGREMessage() {
  try {
    console.log('🎯 Creating authentic GRE message to match Staff Portal screenshot...');
    
    // Create the exact message shown in the Staff Portal screenshot
    const { data: greMessage, error: greError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .insert([{
        player_id: 29,
        player_name: 'Vignesh Gana',
        message: 'Hello Vignesh Gana! I\'m here to help you with: Account Balance Issue - Urgent Help Needed',
        sender: 'gre',
        sender_name: 'Guest Relations Executive',
        session_id: 'f4560670-cfce-4331-97d6-9daa06d3ee8e',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (greError) {
      console.error('❌ Error creating GRE message:', greError);
      return;
    }
    
    console.log('✅ GRE message created successfully:', greMessage.id);
    console.log('📝 Message:', greMessage.message);
    
    // Verify all messages for player 29
    const { data: allMessages, error: fetchError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .select('*')
      .eq('player_id', 29)
      .order('created_at', { ascending: true });
    
    if (fetchError) {
      console.error('❌ Error fetching messages:', fetchError);
      return;
    }
    
    console.log(`\n✅ Total messages for player 29: ${allMessages.length}`);
    allMessages.forEach((msg, i) => {
      console.log(`${i+1}. [${msg.sender.toUpperCase()}] ${msg.sender_name}: "${msg.message}"`);
      console.log(`   📅 ${new Date(msg.created_at).toLocaleTimeString()}`);
    });
    
    console.log('\n🔍 Now both Player Portal and Staff Portal should show the SAME messages');
    console.log('If Staff Portal still shows different messages, it\'s using a different database.');
    
  } catch (error) {
    console.error('❌ Failed to create GRE message:', error);
  }
}

createAuthenticGREMessage();