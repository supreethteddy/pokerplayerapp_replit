import { createClient } from '@supabase/supabase-js';
import { dbStorage } from './database';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function migrateDataToSupabase() {
  console.log('Starting migration from PostgreSQL to Supabase...');
  
  try {
    // Get player data from PostgreSQL
    const player = await dbStorage.getPlayerByEmail('vigneshthc@gmail.com');
    
    if (!player) {
      console.log('No player found in PostgreSQL');
      return;
    }
    
    console.log('Found player in PostgreSQL:', player);
    
    // First check if player already exists in Supabase
    const { data: existingPlayer, error: checkError } = await supabase
      .from('players')
      .select('*')
      .eq('email', player.email)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing player:', checkError);
      return;
    }
    
    if (existingPlayer) {
      console.log('Player already exists in Supabase:', existingPlayer);
      return;
    }
    
    // Insert player data into Supabase
    const { data, error } = await supabase
      .from('players')
      .insert({
        email: player.email,
        password: player.password,
        first_name: player.firstName,
        last_name: player.lastName,
        phone: player.phone,
        kyc_status: player.kycStatus,
        balance: player.balance,
        total_deposits: player.totalDeposits,
        total_withdrawals: player.totalWithdrawals,
        total_winnings: player.totalWinnings,
        total_losses: player.totalLosses,
        games_played: player.gamesPlayed,
        hours_played: player.hoursPlayed,
        created_at: player.createdAt
      })
      .select();
    
    if (error) {
      console.error('Error inserting into Supabase:', error);
    } else {
      console.log('Successfully migrated player to Supabase:', data);
    }
    
  } catch (error) {
    console.error('Migration error:', error);
  }
}

migrateDataToSupabase();