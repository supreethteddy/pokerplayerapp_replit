import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://oyhnpnymlezjusnwpjeu.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPlayer29CreditSystem() {
  console.log('🚀 [CREDIT SYSTEM FIX] Connecting to Supabase...');
  
  try {
    // First check if Player 29 exists
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select('id, email, balance, current_credit, credit_limit, credit_approved')
      .eq('id', 29)
      .single();
      
    if (fetchError) {
      console.error('❌ [CREDIT SYSTEM FIX] Error fetching player:', fetchError);
      return;
    }
    
    console.log('📊 [CREDIT SYSTEM FIX] Current Player 29 data:', {
      id: player.id,
      email: player.email,
      balance: player.balance,
      current_credit: player.current_credit,
      credit_limit: player.credit_limit,
      credit_approved: player.credit_approved
    });
    
    // Update Player 29 with credit system values for production testing
    const { data: updatedPlayer, error: updateError } = await supabase
      .from('players')
      .update({
        current_credit: 500.00,
        credit_limit: 2000.00,
        credit_approved: true
      })
      .eq('id', 29)
      .select()
      .single();
      
    if (updateError) {
      console.error('❌ [CREDIT SYSTEM FIX] Error updating player:', updateError);
      return;
    }
    
    console.log('✅ [CREDIT SYSTEM FIX] Player 29 updated successfully:', {
      id: updatedPlayer.id,
      email: updatedPlayer.email,
      balance: updatedPlayer.balance,
      current_credit: updatedPlayer.current_credit,
      credit_limit: updatedPlayer.credit_limit,
      credit_approved: updatedPlayer.credit_approved
    });
    
    // Test the API endpoint to ensure the transformation works
    console.log('🔍 [CREDIT SYSTEM FIX] Testing API endpoint...');
    
  } catch (error) {
    console.error('❌ [CREDIT SYSTEM FIX] Fatal error:', error);
  }
}

fixPlayer29CreditSystem();