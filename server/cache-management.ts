import { supabase } from './supabase';

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
}

export const cacheManager = CacheManager.getInstance();