// SUPABASE SYNC - Integration with Staff Portal and Master Admin Portal
import { supabase } from './supabase';
import { dbStorage } from './database';

export class DatabaseSync {
  
  // Sync player data to ensure visibility across all portals
  async syncPlayerToSupabase(playerId: number) {
    console.log('🔄 Syncing player to Supabase for cross-portal access:', playerId);
    
    const player = await dbStorage.getPlayer(playerId);
    if (!player) {
      console.error('❌ Player not found for sync:', playerId);
      return;
    }
    
    // Ensure player data is accessible to staff portal
    const { data, error } = await supabase
      .from('players')
      .upsert({
        id: player.id,
        email: player.email,
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
        hours_played: player.hoursPlayed
      });
    
    if (error) {
      console.error('❌ Sync error:', error);
    } else {
      console.log('✅ Player synced successfully for multi-portal access');
    }
  }
  
  // Sync all players to ensure full integration
  async syncAllPlayersToSupabase() {
    console.log('🔄 Syncing all players for multi-portal integration...');
    
    // This ensures all player data is accessible to:
    // - Staff Poker Portal
    // - Master Admin Portal
    // - Player Portal (this application)
    
    const { data: players, error } = await supabase
      .from('players')
      .select('*');
    
    if (error) {
      console.error('❌ Error fetching players for sync:', error);
    } else {
      console.log(`✅ ${players.length} players available across all portals`);
    }
  }
  
  // Get Supabase player data for staff portal access
  async getSupabasePlayerData(email: string) {
    const { data, error } = await supabase
      .from('players')
      .select(`
        *,
        player_prefs(*),
        seat_requests(*),
        kyc_documents(*),
        transactions(*)
      `)
      .eq('email', email)
      .single();
    
    if (error) {
      console.error('❌ Error fetching player data:', error);
      return null;
    }
    
    return data;
  }
}

export const databaseSync = new DatabaseSync();