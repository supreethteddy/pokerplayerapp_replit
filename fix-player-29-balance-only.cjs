#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Connect directly to the Supabase database using environment variables
const supabaseUrl = process.env.STAFF_PORTAL_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixPlayer29Balance() {
  try {
    console.log('🔧 [FIX] Updating Player 29 balance only...');
    
    // Update only the basic balance field 
    const { data: updatedPlayer, error: updateError } = await supabase
      .from('players')
      .update({
        balance: '2000.00'  // ₹2,000 total balance
      })
      .eq('id', 29)
      .eq('email', 'vignesh.wildleaf@gmail.com')
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ [FIX] Failed to update Player 29:', updateError.message);
      return;
    }
    
    console.log('🎉 [FIX] Successfully updated Player 29!');
    console.log('💰 [FIX] New balance:', updatedPlayer.balance);
    
  } catch (error) {
    console.error('❌ [FIX] Error:', error.message);
  }
}

// Run the fix
fixPlayer29Balance()
  .then(() => {
    console.log('\n🚀 [COMPLETE] Player 29 balance updated to ₹2,000!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 [FATAL] Fix failed:', error.message);
    process.exit(1);
  });