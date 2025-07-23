// Monitor Staff Portal database connection and help with integration
const { createClient } = require('@supabase/supabase-js');

const staffPortalSupabase = createClient(
  'https://oyhnpnymlezjusnwpjeu.supabase.co',
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY
);

let messageCount = 0;
let lastMessageId = null;

async function monitorStaffPortalActivity() {
  console.log('🔄 MONITORING STAFF PORTAL DATABASE ACTIVITY');
  console.log('===========================================');
  console.log('Expected Database: https://oyhnpnymlezjusnwpjeu.supabase.co');
  console.log('Monitoring for changes in GRE chat messages...\n');
  
  // Initial baseline
  const { data: initialMessages, error } = await staffPortalSupabase
    .from('gre_chat_messages')
    .select('*')
    .eq('player_id', 29)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error('❌ Failed to establish baseline:', error);
    return;
  }
  
  messageCount = initialMessages.length;
  lastMessageId = initialMessages[initialMessages.length - 1]?.id;
  
  console.log(`📊 Baseline: ${messageCount} messages for player 29`);
  console.log(`🆔 Last message ID: ${lastMessageId}`);
  console.log(`💬 Last message: "${initialMessages[initialMessages.length - 1]?.message}"`);
  console.log('\n🔍 Monitoring for Staff Portal activity...');
  
  // Monitor every 3 seconds
  setInterval(async () => {
    try {
      const { data: currentMessages, error: monitorError } = await staffPortalSupabase
        .from('gre_chat_messages')
        .select('*')
        .eq('player_id', 29)
        .order('created_at', { ascending: true });
      
      if (monitorError) {
        console.error('❌ Monitor error:', monitorError);
        return;
      }
      
      // Check for changes
      const currentCount = currentMessages.length;
      const currentLastId = currentMessages[currentMessages.length - 1]?.id;
      
      if (currentCount !== messageCount || currentLastId !== lastMessageId) {
        console.log(`\n🚨 ACTIVITY DETECTED! ${new Date().toLocaleTimeString()}`);
        console.log(`📊 Message count changed: ${messageCount} → ${currentCount}`);
        
        if (currentCount > messageCount) {
          // New messages added
          const newMessages = currentMessages.slice(messageCount);
          console.log(`✅ ${newMessages.length} new message(s) added:`);
          
          newMessages.forEach((msg, i) => {
            console.log(`${messageCount + i + 1}. [${msg.sender.toUpperCase()}] ${msg.sender_name}: "${msg.message}"`);
            console.log(`    📅 ${new Date(msg.created_at).toLocaleTimeString()}`);
            console.log(`    🆔 ID: ${msg.id}`);
            
            if (msg.sender === 'gre') {
              console.log('    🎯 GRE RESPONSE DETECTED - Staff Portal is active!');
            }
          });
          
          // Check if Staff Portal is using the right database
          if (newMessages.some(msg => msg.sender === 'gre' && msg.sender_name !== 'Integration Test GRE')) {
            console.log('\n🎉 SUCCESS: Staff Portal is writing to the correct database!');
            console.log('✅ Both portals are now synchronized');
          }
        }
        
        messageCount = currentCount;
        lastMessageId = currentLastId;
        
        console.log('\n🔄 Continuing to monitor...');
      }
      
      // Show current status every 30 seconds
      if (Date.now() % 30000 < 3000) {
        console.log(`⏰ ${new Date().toLocaleTimeString()}: Monitoring... (${currentCount} messages)`);
      }
      
    } catch (error) {
      console.error('❌ Monitor loop error:', error);
    }
  }, 3000);
  
  // Show integration tips
  setTimeout(() => {
    console.log('\n💡 STAFF PORTAL INTEGRATION TIPS:');
    console.log('=================================');
    console.log('If Staff Portal is not showing the same messages:');
    console.log('1. Check environment variables (SUPABASE_URL, SUPABASE_SERVICE_KEY)');
    console.log('2. Verify Supabase client configuration');
    console.log('3. Ensure database queries target player_id = 29');
    console.log('4. Check for caching or mock data in Staff Portal code');
    console.log('\nExpected Staff Portal view:');
    console.log('- Active Player Chats: 1 (Vignesh Gana)');
    console.log('- Messages: 3+ (including GRE responses)');
    console.log('- Session ID: f4560670-cfce-4331-97d6-9daa06d3ee8e');
  }, 10000);
}

// Start monitoring
monitorStaffPortalActivity().catch(console.error);

// Keep the script running
process.on('SIGINT', () => {
  console.log('\n🛑 Monitoring stopped by user');
  process.exit(0);
});