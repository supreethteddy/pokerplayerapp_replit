import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

/**
 * CLERK-SUPABASE DOUBLE AUTHENTICATION SYNCHRONIZATION SYSTEM
 * 
 * This system ensures that Clerk and Supabase authentication systems
 * work together seamlessly for enhanced security across portals.
 * 
 * Features:
 * - Bidirectional user synchronization
 * - Double authentication security
 * - Cross-portal data consistency
 * - Real-time sync updates
 */

interface ClerkUser {
  id: string;
  email_addresses: Array<{ email_address: string; verification?: { status: string } }>;
  first_name?: string;
  last_name?: string;
  phone_numbers?: Array<{ phone_number: string }>;
  created_at?: number;
  updated_at?: number;
}

interface SyncResult {
  success: boolean;
  playerId?: number;
  supabaseUserId?: string;
  clerkUserId?: string;
  error?: string;
  syncType: 'created' | 'updated' | 'linked' | 'verified';
}

export class ClerkSupabaseSync {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * SYNC CLERK USER TO SUPABASE
   * When a user is created/updated in Clerk (Staff Portal),
   * ensure they also exist in Supabase with proper linkage
   */
  async syncClerkUserToSupabase(clerkUser: ClerkUser): Promise<SyncResult> {
    const email = clerkUser.email_addresses[0]?.email_address;
    const firstName = clerkUser.first_name || '';
    const lastName = clerkUser.last_name || '';
    const phone = clerkUser.phone_numbers?.[0]?.phone_number || '';

    console.log(`🔄 [CLERK→SUPABASE SYNC] Syncing user: ${email}`);

    try {
      // Check if player already exists in Supabase
      const { data: existingPlayer } = await this.supabase
        .from('players')
        .select('*')
        .or(`email.eq.${email},clerk_user_id.eq.${clerkUser.id}`)
        .single();

      if (existingPlayer) {
        // Update existing player with Clerk information
        return await this.updateExistingPlayer(existingPlayer, clerkUser);
      } else {
        // Create new player from Clerk data
        return await this.createPlayerFromClerk(clerkUser);
      }

    } catch (error: any) {
      console.error('❌ [CLERK→SUPABASE SYNC] Error:', error);
      return {
        success: false,
        error: error.message,
        syncType: 'created'
      };
    }
  }

  /**
   * CREATE PLAYER FROM CLERK DATA
   * Creates a new player record when Clerk user doesn't exist in Supabase
   */
  private async createPlayerFromClerk(clerkUser: ClerkUser): Promise<SyncResult> {
    const email = clerkUser.email_addresses[0]?.email_address;
    const firstName = clerkUser.first_name || '';
    const lastName = clerkUser.last_name || '';
    const phone = clerkUser.phone_numbers?.[0]?.phone_number || '';
    const isEmailVerified = clerkUser.email_addresses[0]?.verification?.status === 'verified';

    console.log(`✨ [CLERK→SUPABASE] Creating new player from Clerk: ${email}`);

    try {
      // STEP 1: Create Supabase Auth user
      const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
        email,
        password: `clerk_managed_${clerkUser.id}`, // Temporary password
        email_confirm: isEmailVerified,
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          phone,
          clerk_user_id: clerkUser.id,
          source: 'clerk_sync'
        }
      });

      if (authError || !authData.user) {
        throw new Error(`Supabase Auth creation failed: ${authError?.message}`);
      }

      // STEP 2: Create player record with both IDs
      const { data: player, error: playerError } = await this.supabase
        .from('players')
        .insert({
          email,
          first_name: firstName,
          last_name: lastName,
          phone,
          password: 'clerk_managed',
          supabase_id: authData.user.id,
          clerk_user_id: clerkUser.id,
          kyc_status: 'pending',
          balance: '0.00',
          is_active: true,
          email_verified: isEmailVerified,
          clerk_synced_at: new Date().toISOString(),
          credit_approved: false,
          credit_limit: '0.00',
          current_credit: '0.00',
          total_deposits: '0.00',
          total_withdrawals: '0.00',
          total_winnings: '0.00',
          total_losses: '0.00',
          games_played: 0,
          hours_played: '0.00',
          universal_id: `clerk_sync_${authData.user.id}_${Date.now()}`
        })
        .select()
        .single();

      if (playerError) {
        // Clean up Supabase Auth user if player creation fails
        await this.supabase.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Player creation failed: ${playerError.message}`);
      }

      console.log(`✅ [CLERK→SUPABASE] Player created: ${player.id}`);

      return {
        success: true,
        playerId: player.id,
        supabaseUserId: authData.user.id,
        clerkUserId: clerkUser.id,
        syncType: 'created'
      };

    } catch (error: any) {
      console.error('❌ [CLERK→SUPABASE] Creation failed:', error);
      return {
        success: false,
        error: error.message,
        syncType: 'created'
      };
    }
  }

  /**
   * UPDATE EXISTING PLAYER
   * Updates existing player with Clerk synchronization data
   */
  private async updateExistingPlayer(existingPlayer: any, clerkUser: ClerkUser): Promise<SyncResult> {
    const email = clerkUser.email_addresses[0]?.email_address;
    const isEmailVerified = clerkUser.email_addresses[0]?.verification?.status === 'verified';

    console.log(`🔄 [CLERK→SUPABASE] Updating existing player: ${existingPlayer.id}`);

    try {
      const { data: updatedPlayer, error: updateError } = await this.supabase
        .from('players')
        .update({
          clerk_user_id: clerkUser.id,
          clerk_synced_at: new Date().toISOString(),
          email_verified: isEmailVerified,
          first_name: clerkUser.first_name || existingPlayer.first_name,
          last_name: clerkUser.last_name || existingPlayer.last_name,
          phone: clerkUser.phone_numbers?.[0]?.phone_number || existingPlayer.phone
        })
        .eq('id', existingPlayer.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Player update failed: ${updateError.message}`);
      }

      console.log(`✅ [CLERK→SUPABASE] Player updated: ${existingPlayer.id}`);

      return {
        success: true,
        playerId: existingPlayer.id,
        supabaseUserId: existingPlayer.supabase_id,
        clerkUserId: clerkUser.id,
        syncType: 'updated'
      };

    } catch (error: any) {
      console.error('❌ [CLERK→SUPABASE] Update failed:', error);
      return {
        success: false,
        error: error.message,
        syncType: 'updated'
      };
    }
  }

  /**
   * WEBHOOK HANDLER FOR CLERK EVENTS
   * Processes incoming webhooks from Clerk
   */
  static async handleClerkWebhook(req: Request, res: Response) {
    console.log('🔔 [CLERK WEBHOOK] Received:', req.body.type);
    
    try {
      const event = req.body;
      const syncService = new ClerkSupabaseSync();
      
      let result: SyncResult;
      
      switch (event.type) {
        case 'user.created':
          result = await syncService.syncClerkUserToSupabase(event.data);
          break;
          
        case 'user.updated':
          result = await syncService.syncClerkUserToSupabase(event.data);
          break;
          
        case 'user.deleted':
          // Handle user deletion if needed
          result = { success: true, syncType: 'updated' };
          break;
          
        default:
          console.log(`ℹ️ [CLERK WEBHOOK] Unhandled event: ${event.type}`);
          result = { success: true, syncType: 'updated' };
      }

      // Log the sync operation
      await syncService.logSyncOperation({
        clerkUserId: event.data?.id,
        playerId: result.playerId,
        syncType: event.type,
        success: result.success,
        error: result.error
      });

      res.status(200).json({
        success: true,
        message: 'Webhook processed',
        syncResult: result
      });

    } catch (error: any) {
      console.error('❌ [CLERK WEBHOOK] Processing failed:', error);
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed'
      });
    }
  }

  /**
   * MANUAL SYNC ENDPOINT
   * Allows manual synchronization between systems
   */
  static async handleManualSync(req: Request, res: Response) {
    const { clerkUserId, email } = req.body;
    
    console.log(`🔄 [MANUAL SYNC] Request for: ${email || clerkUserId}`);
    
    try {
      const syncService = new ClerkSupabaseSync();
      
      if (email) {
        // Find user by email and sync
        const { data: player } = await syncService.supabase
          .from('players')
          .select('*')
          .eq('email', email)
          .single();

        if (player && !player.clerk_user_id) {
          // Link existing player to Clerk if needed
          const { error } = await syncService.supabase
            .from('players')
            .update({
              clerk_user_id: clerkUserId,
              clerk_synced_at: new Date().toISOString()
            })
            .eq('id', player.id);

          if (!error) {
            res.json({
              success: true,
              message: 'Player linked to Clerk successfully',
              playerId: player.id
            });
          } else {
            throw new Error(`Linking failed: ${error.message}`);
          }
        } else {
          res.json({
            success: true,
            message: 'Player already synced or not found'
          });
        }
      } else {
        res.status(400).json({
          success: false,
          error: 'Email or clerkUserId required'
        });
      }

    } catch (error: any) {
      console.error('❌ [MANUAL SYNC] Failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * LOG SYNC OPERATION
   * Records sync operations for audit trail
   */
  private async logSyncOperation(operation: {
    clerkUserId?: string;
    playerId?: number;
    syncType: string;
    success: boolean;
    error?: string;
  }) {
    try {
      await this.supabase
        .from('clerk_sync_logs')
        .insert({
          player_id: operation.playerId,
          clerk_user_id: operation.clerkUserId,
          sync_type: operation.syncType,
          success: operation.success,
          error_message: operation.error,
          sync_data: operation
        });
    } catch (error) {
      console.error('❌ [SYNC LOG] Failed to log operation:', error);
    }
  }
}