import { supabase } from './supabase';
import { dbStorage } from './database';

export class CacheManager {
  private static instance: CacheManager;
  private authCache = new Map<string, any>();
  private lastCacheCheck = new Map<string, number>();
  
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Check if Supabase auth user actually exists (not cached)
   */
  async verifySupabaseUserExists(supabaseId: string): Promise<boolean> {
    try {
      console.log('🔍 [CacheManager] Checking if Supabase user exists:', supabaseId);
      
      // Force fresh check from Supabase
      const { data: user, error } = await supabase.auth.admin.getUserById(supabaseId);
      
      if (error) {
        console.log('❌ [CacheManager] Error checking user:', error.message);
        return false;
      }
      
      const exists = !!user.user;
      console.log('🔍 [CacheManager] Supabase user exists:', exists);
      return exists;
    } catch (error: any) {
      console.log('❌ [CacheManager] Exception checking user:', error.message);
      return false;
    }
  }

  /**
   * Clear player from all caches
   */
  async clearPlayerCache(email: string, supabaseId?: string): Promise<void> {
    console.log('🗑️ [CacheManager] Clearing cache for:', email, supabaseId);
    
    // Clear auth cache
    this.authCache.delete(email);
    if (supabaseId) {
      this.authCache.delete(supabaseId);
    }
    
    // Clear timestamp cache
    this.lastCacheCheck.delete(email);
    if (supabaseId) {
      this.lastCacheCheck.delete(supabaseId);
    }
    
    console.log('✅ [CacheManager] Cache cleared');
  }

  /**
   * Check if player email is available for registration
   */
  async isEmailAvailable(email: string): Promise<boolean> {
    try {
      console.log('📧 [CacheManager] Checking email availability:', email);
      
      // Check database first
      const existingPlayer = await dbStorage.getPlayerByEmail(email);
      
      if (!existingPlayer) {
        console.log('✅ [CacheManager] Email available - no database record');
        return true;
      }
      
      console.log('🔍 [CacheManager] Found existing player:', {
        id: existingPlayer.id,
        email: existingPlayer.email,
        supabaseId: existingPlayer.supabaseId
      });
      
      // If player has no supabaseId, they're orphaned
      if (!existingPlayer.supabaseId) {
        console.log('🗑️ [CacheManager] Player has no supabaseId - checking if should be cleaned up');
        return false; // Still exists in database
      }
      
      // Check if Supabase user actually exists
      const supabaseExists = await this.verifySupabaseUserExists(existingPlayer.supabaseId);
      
      if (!supabaseExists) {
        console.log('🗑️ [CacheManager] Supabase user deleted but database record exists');
        return false; // Database record exists but Supabase user doesn't
      }
      
      console.log('❌ [CacheManager] Email not available - active user exists');
      return false;
    } catch (error: any) {
      console.error('❌ [CacheManager] Error checking email availability:', error);
      return false; // Err on the side of caution
    }
  }

  /**
   * Clean up orphaned players (database records without Supabase users)
   */
  async cleanupOrphanedPlayers(): Promise<void> {
    try {
      console.log('🧹 [CacheManager] Starting orphaned player cleanup');
      
      const allPlayers = await dbStorage.getAllPlayers();
      console.log('🔍 [CacheManager] Found', allPlayers.length, 'players to check');
      
      for (const player of allPlayers) {
        if (!player.supabaseId) {
          console.log('⚠️ [CacheManager] Player has no supabaseId:', player.email);
          continue;
        }
        
        const supabaseExists = await this.verifySupabaseUserExists(player.supabaseId);
        
        if (!supabaseExists) {
          console.log('🗑️ [CacheManager] Orphaned player found - Supabase user deleted:', {
            playerId: player.id,
            email: player.email,
            supabaseId: player.supabaseId
          });
          
          // For now, just log - don't auto-delete
          // Could add auto-cleanup logic here if needed
        }
      }
      
      console.log('✅ [CacheManager] Orphaned player cleanup completed');
    } catch (error: any) {
      console.error('❌ [CacheManager] Error during cleanup:', error);
    }
  }

  /**
   * Fix player with missing supabaseId by creating new Supabase user
   */
  async fixPlayerWithMissingSupabaseId(playerId: number): Promise<{ success: boolean; supabaseId?: string }> {
    try {
      console.log('🔧 [CacheManager] Fixing player with missing supabaseId:', playerId);
      
      const player = await dbStorage.getPlayer(playerId);
      if (!player) {
        console.log('❌ [CacheManager] Player not found:', playerId);
        return { success: false };
      }
      
      if (player.supabaseId) {
        console.log('✅ [CacheManager] Player already has supabaseId:', player.supabaseId);
        return { success: true, supabaseId: player.supabaseId };
      }
      
      console.log('🔧 [CacheManager] Creating Supabase user for existing player:', player.email);
      
      // Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: player.email,
        password: player.password || 'TempPassword123!',
        email_confirm: true
      });
      
      if (authError) {
        console.log('❌ [CacheManager] Failed to create Supabase user:', authError.message);
        return { success: false };
      }
      
      // Update player with supabaseId
      await dbStorage.updatePlayerSupabaseId(playerId, authData.user.id);
      
      console.log('✅ [CacheManager] Player fixed with supabaseId:', authData.user.id);
      return { success: true, supabaseId: authData.user.id };
      
    } catch (error: any) {
      console.error('❌ [CacheManager] Error fixing player:', error);
      return { success: false };
    }
  }
}

export const cacheManager = CacheManager.getInstance();