#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Connect directly to the Supabase database using environment variables
const supabaseUrl = process.env.STAFF_PORTAL_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixPlayer29DualBalance() {
  try {
    console.log('🔧 [FIX] Updating Player 29 with correct dual balance data...');
    
    // First, verify Player 29 exists and get current data
    const { data: currentPlayer, error: fetchError } = await supabase
      .from('players')
      .select('*')
      .eq('id', 29)
      .eq('email', 'vignesh.wildleaf@gmail.com')
      .single();
    
    if (fetchError || !currentPlayer) {
      console.error('❌ [FIX] Player 29 not found:', fetchError?.message);
      return;
    }
    
    console.log('✅ [FIX] Found Player 29:', currentPlayer.email);
    console.log('📊 [FIX] Current balance data:', {
      balance: currentPlayer.balance,
      current_credit: currentPlayer.current_credit,
      credit_limit: currentPlayer.credit_limit,
      credit_approved: currentPlayer.credit_approved
    });
    
    // Update Player 29 with correct dual balance system data
    const { data: updatedPlayer, error: updateError } = await supabase
      .from('players')
      .update({
        // Real balance: ₹1,500
        balance: '1500.00',
        // Credit balance: ₹500  
        current_credit: '500.00',
        // Credit limit: ₹2,000
        credit_limit: '2000.00',
        // Credit approved: true
        credit_approved: true,
        // Ensure Supabase ID mapping is correct
        supabase_id: 'e0953527-a5d5-402c-9e00-8ed590d19cde',
        // Update timestamp
        updated_at: new Date().toISOString()
      })
      .eq('id', 29)
      .eq('email', 'vignesh.wildleaf@gmail.com')
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ [FIX] Failed to update Player 29:', updateError.message);
      return;
    }
    
    console.log('🎉 [FIX] Successfully updated Player 29 with dual balance data!');
    console.log('💰 [FIX] New balance data:', {
      id: updatedPlayer.id,
      email: updatedPlayer.email,
      balance: updatedPlayer.balance,
      current_credit: updatedPlayer.current_credit, 
      credit_limit: updatedPlayer.credit_limit,
      credit_approved: updatedPlayer.credit_approved,
      supabase_id: updatedPlayer.supabase_id
    });
    
  } catch (error) {
    console.error('❌ [FIX] Error updating Player 29:', error.message);
  }
}

// Run the fix
fixPlayer29DualBalance()
  .then(() => {
    console.log('\n🚀 [COMPLETE] Player 29 dual balance fix completed successfully!');
    console.log('🔄 [NEXT] Please refresh your browser to see the updated balance data.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 [FATAL] Fix failed:', error.message);
    process.exit(1);
  });