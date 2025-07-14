import { createClient } from '@supabase/supabase-js';
import { db } from './database';
import { players, playerPrefs, kycDocuments, seatRequests } from "@shared/schema";
import { eq } from 'drizzle-orm';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export class DatabaseSync {
  
  // Sync player data to Supabase
  async syncPlayerToSupabase(playerId: number) {
    try {
      // Get player data from our database
      const player = await db.select().from(players).where(eq(players.id, playerId));
      const prefs = await db.select().from(playerPrefs).where(eq(playerPrefs.playerId, playerId));
      const kyc = await db.select().from(kycDocuments).where(eq(kycDocuments.playerId, playerId));
      
      if (player.length > 0) {
        // Sync to Supabase tables (assuming similar schema)
        const playerData = player[0];
        
        // Insert or update player in Supabase (use actual admin portal schema)
        console.log('Attempting to sync player to Supabase:', playerData.email);
        
        // Try syncing with full schema first, fallback to basic schema if columns don't exist
        let syncData: any = {
          email: playerData.email,
          full_name: `${playerData.firstName} ${playerData.lastName}`,
          phone: playerData.phone,
          kyc_status: playerData.kycStatus || 'pending',
          created_at: playerData.createdAt,
          updated_at: new Date().toISOString()
        };
        
        // Only add financial fields if they exist in Supabase (we'll handle the error in the upsert)
        syncData = {
          ...syncData,
          balance: playerData.balance || '0.00',
          total_deposits: playerData.totalDeposits || '0.00',
          total_withdrawals: playerData.totalWithdrawals || '0.00',
          total_winnings: playerData.totalWinnings || '0.00',
          total_losses: playerData.totalLosses || '0.00',
          games_played: playerData.gamesPlayed || 0,
          hours_played: playerData.hoursPlayed || '0.00'
        };
        
        const { data: supabasePlayer, error: playerError } = await supabase
          .from('players')
          .upsert(syncData, { onConflict: 'email' });
        
        if (playerError) {
          console.error('Error syncing player to Supabase:', playerError);
          
          // If it's a schema error, try basic sync without financial fields
          if (playerError.code === 'PGRST204' || playerError.message.includes('column')) {
            console.log('Retrying sync with basic schema (no financial fields)...');
            
            const basicSyncData = {
              email: playerData.email,
              full_name: `${playerData.firstName} ${playerData.lastName}`,
              phone: playerData.phone,
              kyc_status: playerData.kycStatus || 'pending',
              created_at: playerData.createdAt,
              updated_at: new Date().toISOString()
            };
            
            const { error: basicError } = await supabase
              .from('players')
              .upsert(basicSyncData, { onConflict: 'email' });
            
            if (basicError) {
              console.error('Basic sync also failed:', basicError);
              return false;
            }
            
            console.log('Basic sync successful (financial data not synced)');
          } else {
            return false;
          }
        } else {
          console.log('Full sync successful with financial data');
        }
        
        // After successful player sync, get the Supabase player ID
        const syncedPlayer = await supabase
          .from('players')
          .select('id')
          .eq('email', playerData.email)
          .single();
        
        if (syncedPlayer.data) {
          // Sync player preferences with correct column names
          if (prefs.length > 0) {
            const { error: prefsError } = await supabase
              .from('player_prefs')
              .upsert({
                player_id: syncedPlayer.data.id,
                seat_available: prefs[0].seatAvailable,
                call_time_warning: prefs[0].callTimeWarning,
                game_updates: prefs[0].gameUpdates
              }, { onConflict: 'player_id' });
            
            if (prefsError) {
              console.error('Error syncing player prefs to Supabase:', prefsError);
            }
          }
          
          // Sync KYC documents with correct column names
          for (const doc of kyc) {
            const { error: kycError } = await supabase
              .from('kyc_documents')
              .upsert({
                player_id: syncedPlayer.data.id,
                document_type: doc.documentType,
                file_name: doc.fileName,
                file_url: doc.fileUrl,
                status: doc.status,
                created_at: doc.createdAt
              }, { onConflict: 'player_id,document_type' });
            
            if (kycError) {
              console.error('Error syncing KYC document to Supabase:', kycError);
            }
          }
        }
        

        
        console.log(`Successfully synced player ${playerId} to Supabase`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error in syncPlayerToSupabase:', error);
      return false;
    }
  }
  
  // Sync all players to Supabase
  async syncAllPlayersToSupabase() {
    try {
      const allPlayers = await db.select().from(players);
      
      for (const player of allPlayers) {
        await this.syncPlayerToSupabase(player.id);
      }
      
      console.log(`Synced ${allPlayers.length} players to Supabase`);
      return true;
    } catch (error) {
      console.error('Error in syncAllPlayersToSupabase:', error);
      return false;
    }
  }
  
  // Get player data from Supabase to check sync status
  async getSupabasePlayerData(email: string) {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('email', email);
      
      if (error) {
        console.error('Error fetching player from Supabase:', error);
        return null;
      }
      
      return data?.[0] || null;
    } catch (error) {
      console.error('Error in getSupabasePlayerData:', error);
      return null;
    }
  }
}

export const databaseSync = new DatabaseSync();