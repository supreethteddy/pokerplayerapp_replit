// DEBUG: Database Mismatch Investigation
// This script investigates why Player Portal and Staff Portal show different messages

import { createClient } from '@supabase/supabase-js';

const staffPortalSupabase = createClient(
  'https://oyhnpnymlezjusnwpjeu.supabase.co',
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY
);

console.log('🔍 DATABASE MISMATCH INVESTIGATION');
console.log('==================================');

async function investigateDatabaseMismatch() {
  try {
    // 1. Check what database URL the Player Portal is actually using
    console.log('\n📋 1. PLAYER PORTAL DATABASE CONNECTION:');
    console.log('Expected URL: https://oyhnpnymlezjusnwpjeu.supabase.co');
    console.log('Service Key: ' + (process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY ? 'PRESENT' : 'MISSING'));
    
    // 2. Query current messages in Staff Portal database for player 29
    console.log('\n📋 2. STAFF PORTAL DATABASE - PLAYER 29 MESSAGES:');
    const { data: player29messages, error: player29Error } = await staffPortalSupabase
      .from('gre_chat_messages')
      .select('*')
      .eq('player_id', 29)
      .order('created_at', { ascending: true });
    
    if (player29Error) {
      console.error('❌ Error fetching player 29 messages:', player29Error);
    } else {
      console.log(`✅ Found ${player29messages.length} messages for player 29:`);
      player29messages.forEach((msg, i) => {
        console.log(`${i+1}. [${msg.sender}] ${msg.sender_name}: "${msg.message}"`);
        console.log(`   📅 ${new Date(msg.created_at).toLocaleString()}`);
        console.log(`   🔗 Session: ${msg.session_id}`);
      });
    }
    
    // 3. Check ALL messages in the database to see if there are other messages
    console.log('\n📋 3. ALL MESSAGES IN STAFF PORTAL DATABASE:');
    const { data: allMessages, error: allError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (allError) {
      console.error('❌ Error fetching all messages:', allError);
    } else {
      console.log(`✅ Found ${allMessages.length} recent messages (showing last 10):`);
      allMessages.forEach((msg, i) => {
        console.log(`${i+1}. Player ${msg.player_id} (${msg.player_name}): [${msg.sender}] "${msg.message}"`);
        console.log(`   📅 ${new Date(msg.created_at).toLocaleString()}`);
      });
    }
    
    // 4. Check if there are messages with "Account Balance Issue" text
    console.log('\n📋 4. SEARCHING FOR "ACCOUNT BALANCE ISSUE" MESSAGE:');
    const { data: balanceMessages, error: balanceError } = await staffPortalSupabase
      .from('gre_chat_messages')
      .select('*')
      .ilike('message', '%Account Balance Issue%');
    
    if (balanceError) {
      console.error('❌ Error searching for balance messages:', balanceError);
    } else {
      console.log(`✅ Found ${balanceMessages.length} messages containing "Account Balance Issue":`);
      balanceMessages.forEach((msg, i) => {
        console.log(`${i+1}. Player ${msg.player_id} (${msg.player_name}): [${msg.sender}] "${msg.message}"`);
        console.log(`   📅 ${new Date(msg.created_at).toLocaleString()}`);
        console.log(`   🔗 Session: ${msg.session_id}`);
      });
    }
    
    // 5. Check all sessions to understand session context
    console.log('\n📋 5. ALL CHAT SESSIONS:');
    const { data: sessions, error: sessionError } = await staffPortalSupabase
      .from('gre_chat_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (sessionError) {
      console.error('❌ Error fetching sessions:', sessionError);
    } else {
      console.log(`✅ Found ${sessions.length} recent sessions:`);
      sessions.forEach((session, i) => {
        console.log(`${i+1}. Session: ${session.id}`);
        console.log(`   👤 Player: ${session.player_id} (${session.player_name})`);
        console.log(`   📧 Email: ${session.player_email}`);
        console.log(`   📅 Created: ${new Date(session.created_at).toLocaleString()}`);
        console.log(`   🔗 Status: ${session.status}`);
      });
    }
    
    console.log('\n🔍 ANALYSIS:');
    console.log('============');
    console.log('If Player Portal shows different messages than Staff Portal screenshot,');
    console.log('the Staff Portal may be:');
    console.log('1. Using a different Supabase database URL');
    console.log('2. Showing messages from a different session or player');
    console.log('3. Using cached/mock data instead of live database');
    console.log('4. Connected to a different environment (dev/staging/prod)');
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
  }
}

investigateDatabaseMismatch();