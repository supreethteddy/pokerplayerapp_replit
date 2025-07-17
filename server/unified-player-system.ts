import { createClient } from '@supabase/supabase-js';
import { supabaseOnlyStorage } from './supabase-only-storage';

// UNIVERSAL CROSS-PORTAL SUPABASE CONNECTION
// Connect to Staff Portal's Supabase database for unified system
const supabase = createClient(
  process.env.STAFF_PORTAL_SUPABASE_URL!,
  process.env.STAFF_PORTAL_SUPABASE_SERVICE_KEY!
);

export interface UnifiedPlayer {
  id: number;                  // Application database ID (auto-increment)
  supabaseId: string;         // Supabase auth.users.id (UUID)
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  kycStatus: string;
  balance: string;
  totalDeposits: string;
  totalWithdrawals: string;
  totalWinnings: string;
  totalLosses: string;
  gamesPlayed: number;
  hoursPlayed: string;
  createdAt: Date;
}

export class UnifiedPlayerSystem {
  /**
   * UNIVERSAL CROSS-PORTAL SYSTEM
   * This ensures perfect synchronization across Player Portal, Staff Portal, and Master Admin Portal
   * All functions use universal IDs for seamless cross-portal functionality
   */

  /**
   * Get player by universal ID (works across all portals)
   */
  async getPlayerByUniversalId(universalId: string): Promise<UnifiedPlayer | null> {
    try {
      console.log(`🔄 [UNIVERSAL] Getting player by universal ID: ${universalId}`);
      
      // Try Supabase ID first
      let player = await supabaseOnlyStorage.getPlayerBySupabaseId(universalId);
      if (player) {
        console.log(`✅ [UNIVERSAL] Found player by Supabase ID: ${player.id}`);
        return this.transformToUnifiedPlayer(player);
      }
      
      // Try email lookup
      if (universalId.includes('@')) {
        player = await supabaseOnlyStorage.getPlayerByEmail(universalId);
        if (player) {
          console.log(`✅ [UNIVERSAL] Found player by email: ${player.id}`);
          return this.transformToUnifiedPlayer(player);
        }
      }
      
      // Try numeric ID
      if (!isNaN(Number(universalId))) {
        player = await supabaseOnlyStorage.getPlayer(Number(universalId));
        if (player) {
          console.log(`✅ [UNIVERSAL] Found player by numeric ID: ${player.id}`);
          return this.transformToUnifiedPlayer(player);
        }
      }
      
      console.log(`❌ [UNIVERSAL] No player found for universal ID: ${universalId}`);
      return null;
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL] Error getting player by universal ID:`, error);
      throw error;
    }
  }

  /**
   * Migrate existing players to universal ID system
   */
  async migrateToUniversalIds(): Promise<{ migrated: number; errors: number }> {
    try {
      console.log(`🔄 [UNIVERSAL] Starting universal ID migration`);
      
      let migrated = 0;
      let errors = 0;
      
      // Get all players from Supabase
      const { data: allPlayers, error } = await supabase
        .from('players')
        .select('*');
      
      if (error) {
        throw new Error(`Failed to get players: ${error.message}`);
      }
      
      for (const player of allPlayers) {
        try {
          // Ensure player has universal ID fields
          if (!player.supabase_id) {
            // Try to find matching Supabase auth user
            const { data: authUsers } = await supabase.auth.admin.listUsers();
            const authUser = authUsers.users.find(u => u.email === player.email);
            
            if (authUser) {
              // Update player with Supabase ID
              await supabase
                .from('players')
                .update({ supabase_id: authUser.id })
                .eq('id', player.id);
              
              console.log(`✅ [UNIVERSAL] Updated player ${player.id} with Supabase ID`);
              migrated++;
            }
          } else {
            migrated++;
          }
        } catch (playerError: any) {
          console.error(`❌ [UNIVERSAL] Error migrating player ${player.id}:`, playerError);
          errors++;
        }
      }
      
      console.log(`✅ [UNIVERSAL] Migration completed: ${migrated} migrated, ${errors} errors`);
      return { migrated, errors };
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL] Migration failed:`, error);
      throw error;
    }
  }

  /**
   * Create a new player with unified ID system
   * This bridges Supabase auth.users.id with application players table
   */
  async createPlayer(supabaseUserId: string, playerData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
  }): Promise<UnifiedPlayer> {
    try {
      console.log(`🆔 [UnifiedPlayerSystem] Creating unified player for Supabase ID: ${supabaseUserId}`);
      
      // Check if player already exists by Supabase ID
      const existingPlayer = await this.getPlayerBySupabaseId(supabaseUserId);
      if (existingPlayer) {
        console.log(`🆔 [UnifiedPlayerSystem] Player already exists with ID: ${existingPlayer.id}`);
        return existingPlayer;
      }
      
      // Check if player exists by email
      const emailPlayer = await supabaseOnlyStorage.getPlayerByEmail(playerData.email);
      if (emailPlayer) {
        // Update existing player with Supabase ID
        const updatedPlayer = await supabaseOnlyStorage.updatePlayerSupabaseId(emailPlayer.id, supabaseUserId);
        
        console.log(`🆔 [UnifiedPlayerSystem] Updated existing player ${emailPlayer.id} with Supabase ID`);
        return this.transformToUnifiedPlayer(updatedPlayer);
      }
      
      // Create new player with both IDs
      const newPlayer = await supabaseOnlyStorage.createPlayer({
        ...playerData,
        supabaseId: supabaseUserId
      });
      
      console.log(`🆔 [UnifiedPlayerSystem] Created new unified player - App ID: ${newPlayer.id}, Supabase ID: ${supabaseUserId}`);
      return this.transformToUnifiedPlayer(newPlayer);
      
    } catch (error: any) {
      console.error('🆔 [UnifiedPlayerSystem] Error creating unified player:', error);
      throw error;
    }
  }
  
  /**
   * Get player by Supabase auth.users.id
   */
  async getPlayerBySupabaseId(supabaseUserId: string): Promise<UnifiedPlayer | null> {
    try {
      console.log(`🆔 [UnifiedPlayerSystem] Getting player by Supabase ID: ${supabaseUserId}`);
      
      const player = await supabaseOnlyStorage.getPlayerBySupabaseId(supabaseUserId);
      
      if (!player) {
        console.log(`🆔 [UnifiedPlayerSystem] No player found for Supabase ID: ${supabaseUserId}`);
        return null;
      }
      
      console.log(`🆔 [UnifiedPlayerSystem] Found player - App ID: ${player.id}, Supabase ID: ${supabaseUserId}`);
      return this.transformToUnifiedPlayer(player);
      
    } catch (error: any) {
      console.error('🆔 [UnifiedPlayerSystem] Error getting player by Supabase ID:', error);
      throw error;
    }
  }
  
  /**
   * Get player by application database ID
   */
  async getPlayerById(playerId: number): Promise<UnifiedPlayer | null> {
    try {
      const player = await supabaseOnlyStorage.getPlayer(playerId);
      if (!player) {
        return null;
      }
      return this.transformToUnifiedPlayer(player);
    } catch (error: any) {
      console.error('🆔 [UnifiedPlayerSystem] Error getting player by ID:', error);
      throw error;
    }
  }
  
  /**
   * Get player by email
   */
  async getPlayerByEmail(email: string): Promise<UnifiedPlayer | null> {
    try {
      const player = await supabaseOnlyStorage.getPlayerByEmail(email);
      if (!player) {
        return null;
      }
      return this.transformToUnifiedPlayer(player);
    } catch (error: any) {
      console.error('🆔 [UnifiedPlayerSystem] Error getting player by email:', error);
      throw error;
    }
  }
  
  /**
   * Verify Supabase auth user exists and is authenticated
   */
  async verifySupabaseUser(supabaseUserId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.auth.admin.getUserById(supabaseUserId);
      
      if (error || !data.user) {
        console.log(`🆔 [UnifiedPlayerSystem] Supabase user not found: ${supabaseUserId}`);
        return false;
      }
      
      console.log(`🆔 [UnifiedPlayerSystem] Supabase user verified: ${supabaseUserId}`);
      return true;
    } catch (error: any) {
      console.error('🆔 [UnifiedPlayerSystem] Error verifying Supabase user:', error);
      return false;
    }
  }
  
  /**
   * Sync existing players with Supabase auth system
   */
  async syncExistingPlayers(): Promise<void> {
    try {
      console.log('🆔 [UnifiedPlayerSystem] Starting player sync...');
      
      // Get all players without Supabase ID
      const playersWithoutSupabaseId = await db
        .select()
        .from(players)
        .where(eq(players.supabaseId, null));
      
      console.log(`🆔 [UnifiedPlayerSystem] Found ${playersWithoutSupabaseId.length} players without Supabase ID`);
      
      for (const player of playersWithoutSupabaseId) {
        try {
          // Try to find corresponding Supabase auth user by email
          const { data: authUsers, error } = await supabase.auth.admin.listUsers();
          
          if (error) {
            console.error('🆔 [UnifiedPlayerSystem] Error listing Supabase users:', error);
            continue;
          }
          
          const authUser = authUsers.users.find(u => u.email === player.email);
          
          if (authUser) {
            // Update player with Supabase ID
            await db
              .update(players)
              .set({ supabaseId: authUser.id })
              .where(eq(players.id, player.id));
            
            console.log(`🆔 [UnifiedPlayerSystem] Synced player ${player.id} with Supabase ID: ${authUser.id}`);
          } else {
            console.log(`🆔 [UnifiedPlayerSystem] No Supabase auth user found for player ${player.id} (${player.email})`);
          }
        } catch (syncError: any) {
          console.error(`🆔 [UnifiedPlayerSystem] Error syncing player ${player.id}:`, syncError);
        }
      }
      
      console.log('🆔 [UnifiedPlayerSystem] Player sync completed');
    } catch (error: any) {
      console.error('🆔 [UnifiedPlayerSystem] Error in player sync:', error);
    }
  }
  
  /**
   * Transform database player to unified player format
   */
  private transformToUnifiedPlayer(player: any): UnifiedPlayer {
    return {
      id: player.id,
      supabaseId: player.supabaseId,
      email: player.email,
      firstName: player.firstName,
      lastName: player.lastName,
      phone: player.phone,
      kycStatus: player.kycStatus,
      balance: player.balance,
      totalDeposits: player.totalDeposits,
      totalWithdrawals: player.totalWithdrawals,
      totalWinnings: player.totalWinnings,
      totalLosses: player.totalLosses,
      gamesPlayed: player.gamesPlayed,
      hoursPlayed: player.hoursPlayed,
      createdAt: player.createdAt
    };
  }
}

export const unifiedPlayerSystem = new UnifiedPlayerSystem();