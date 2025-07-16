import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixSupabaseData() {
  console.log('Starting Supabase data fix...');
  
  // First, let's update the existing player to include the supabase_id
  const { data: updateData, error: updateError } = await supabase
    .from('players')
    .update({ supabase_id: '27c6db20-282a-4af0-9473-ea31b63ba6e7' })
    .eq('email', 'vignesh.wildleaf@gmail.com');

  if (updateError) {
    console.error('Error updating existing player:', updateError);
    
    // If the column doesn't exist, let's create a new player with the supabase_id
    const { data: insertData, error: insertError } = await supabase
      .from('players')
      .insert({
        email: 'vignesh.wildleaf@gmail.com',
        password: 'password123',
        first_name: 'Vignesh',
        last_name: 'Wildleaf',
        phone: '1234567890',
        kyc_status: 'pending',
        balance: '0.00',
        total_deposits: '0.00',
        total_withdrawals: '0.00',
        total_winnings: '0.00',
        total_losses: '0.00',
        games_played: 0,
        hours_played: '0.00',
        supabase_id: '27c6db20-282a-4af0-9473-ea31b63ba6e7'
      });

    if (insertError) {
      console.error('Error inserting new player:', insertError);
    } else {
      console.log('New player inserted successfully');
    }
  } else {
    console.log('Player updated successfully');
  }
  
  // Test the lookup
  const { data: lookupData, error: lookupError } = await supabase
    .from('players')
    .select('*')
    .eq('supabase_id', '27c6db20-282a-4af0-9473-ea31b63ba6e7');
  
  console.log('Lookup result:', { data: lookupData, error: lookupError });
}

fixSupabaseData().catch(console.error);