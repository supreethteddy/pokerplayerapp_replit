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
        
        // Insert or update player in Supabase
        const { data: supabasePlayer, error: playerError } = await supabase
          .from('players')
          .upsert({
            id: playerData.id,
            email: playerData.email,
            first_name: playerData.firstName,
            last_name: playerData.lastName,
            phone: playerData.phone,
            kyc_status: playerData.kycStatus,
            created_at: playerData.createdAt
          }, { onConflict: 'id' });
        
        if (playerError) {
          console.error('Error syncing player to Supabase:', playerError);
          return false;
        }
        
        // Sync player preferences
        if (prefs.length > 0) {
          const { error: prefsError } = await supabase
            .from('player_prefs')
            .upsert({
              player_id: prefs[0].playerId,
              seat_available: prefs[0].seatAvailable,
              call_time_warning: prefs[0].callTimeWarning,
              game_updates: prefs[0].gameUpdates
            }, { onConflict: 'player_id' });
          
          if (prefsError) {
            console.error('Error syncing player prefs to Supabase:', prefsError);
          }
        }
        
        // Sync KYC documents
        for (const doc of kyc) {
          const { error: kycError } = await supabase
            .from('kyc_documents')
            .upsert({
              id: doc.id,
              player_id: doc.playerId,
              document_type: doc.documentType,
              file_name: doc.fileName,
              file_url: doc.fileUrl,
              status: doc.status,
              created_at: doc.createdAt
            }, { onConflict: 'id' });
          
          if (kycError) {
            console.error('Error syncing KYC document to Supabase:', kycError);
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
  async getSupabasePlayerData(playerId: number) {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId);
      
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