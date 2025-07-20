import { createClient } from '@supabase/supabase-js';

// Test the Staff Portal Supabase connection for notifications
const staffPortalSupabase = createClient(
  process.env.STAFF_PORTAL_SUPABASE_URL!,
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY!
);

export async function testNotificationConnection() {
  try {
    console.log('🔍 Testing Staff Portal Supabase notification connection...');
    console.log('URL:', process.env.STAFF_PORTAL_SUPABASE_URL);
    console.log('Service key exists:', !!process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY);
    
    // Test basic connection
    const { data: tableCheck, error: tableError } = await staffPortalSupabase
      .from('push_notifications')
      .select('id, target_player_id, title, message, created_at')
      .limit(5);
    
    if (tableError) {
      console.error('❌ Table query error:', tableError);
      return { success: false, error: tableError };
    }
    
    console.log('✅ Staff Portal notifications table accessible');
    console.log('📋 Found notifications:', tableCheck?.length || 0);
    
    if (tableCheck && tableCheck.length > 0) {
      console.log('📄 Sample notification:', tableCheck[0]);
    }
    
    // Test specific query for player 29
    const { data: playerNotifs, error: playerError } = await staffPortalSupabase
      .from('push_notifications')
      .select('*')
      .or('target_player_id.eq.29,broadcast_to_all.eq.true')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (playerError) {
      console.error('❌ Player notification query error:', playerError);
      return { success: false, error: playerError };
    }
    
    console.log('✅ Player 29 notifications:', playerNotifs?.length || 0);
    
    return {
      success: true,
      totalNotifications: tableCheck?.length || 0,
      playerNotifications: playerNotifs?.length || 0,
      data: playerNotifs
    };
    
  } catch (error) {
    console.error('❌ Notification connection test failed:', error);
    return { success: false, error };
  }
}