// Test script to verify table assignments and seated players
// Run: node test-table-assignments.js

const { createClient } = require('@supabase/supabase-js');

// Staff Portal Supabase connection
const staffPortalSupabase = createClient(
  process.env.STAFF_PORTAL_SUPABASE_URL,
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY
);

async function testTableAssignments() {
  console.log('🔍 Testing table assignments and seated players...');
  
  try {
    // Test 1: Check tables
    console.log('\n1. Testing tables query...');
    const { data: tables, error: tablesError } = await staffPortalSupabase
      .from('staff_tables')
      .select('*');
    
    console.log('Tables result:', { count: tables?.length, error: tablesError });
    if (tables?.length > 0) {
      console.log('Sample table:', tables[0]);
    }
    
    // Test 2: Check waitlist with seated players
    console.log('\n2. Testing waitlist/seated players...');
    const { data: waitlist, error: waitlistError } = await staffPortalSupabase
      .from('waitlist')
      .select('*')
      .eq('status', 'seated');
    
    console.log('Seated players result:', { count: waitlist?.length, error: waitlistError });
    if (waitlist?.length > 0) {
      console.log('Sample seated player:', waitlist[0]);
    }
    
    // Test 3: Check table assignments
    console.log('\n3. Testing table assignments...');
    const { data: assignments, error: assignError } = await staffPortalSupabase
      .from('table_assignments')
      .select('*');
    
    console.log('Table assignments result:', { count: assignments?.length, error: assignError });
    if (assignments?.length > 0) {
      console.log('Sample assignment:', assignments[0]);
    }
    
    // Test 4: Check tournaments
    console.log('\n4. Testing tournaments...');
    const { data: tournaments, error: tournamentError } = await staffPortalSupabase
      .from('tournaments')
      .select('*');
    
    console.log('Tournaments result:', { count: tournaments?.length, error: tournamentError });
    if (tournaments?.length > 0) {
      console.log('Sample tournament:', tournaments[0]);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTableAssignments();