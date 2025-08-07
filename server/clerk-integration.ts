import { Request, Response } from 'express';
import { Client } from 'pg';

// Use direct PostgreSQL connection to avoid Supabase schema cache issues
async function getPgClient() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  return client;
}

export interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string; verification?: { status: string } }>;
    first_name?: string;
    last_name?: string;
    phone_numbers?: Array<{ phone_number: string }>;
    created_at?: number;
    updated_at?: number;
  };
}

export class ClerkPlayerSync {
  
  // Webhook endpoint for Clerk events
  static async handleWebhook(req: Request, res: Response) {
    console.log('🔔 [CLERK WEBHOOK] Received event:', req.body.type);
    
    const pgClient = await getPgClient();
    
    try {
      const event: ClerkWebhookEvent = req.body;
      
      // Log the webhook event
      await ClerkPlayerSync.logWebhookEvent(event);
      
      switch (event.type) {
        case 'user.created':
          await ClerkPlayerSync.handleUserCreated(pgClient, event);
          break;
        case 'user.updated': 
          await ClerkPlayerSync.handleUserUpdated(pgClient, event);
          break;
        case 'user.deleted':
          await ClerkPlayerSync.handleUserDeleted(pgClient, event);
          break;
        default:
          console.log(`ℹ️ [CLERK WEBHOOK] Unhandled event type: ${event.type}`);
      }
      
      res.status(200).json({ success: true, message: 'Webhook processed' });
    } catch (error) {
      console.error('❌ [CLERK WEBHOOK] Error processing webhook:', error);
      res.status(500).json({ success: false, error: 'Webhook processing failed' });
    } finally {
      await pgClient.end();
    }
  }
  
  // Sync endpoint for manual synchronization
  static async syncPlayer(req: Request, res: Response) {
    console.log('🔄 [CLERK SYNC] Manual sync request:', req.body);
    
    const pgClient = await getPgClient();
    
    try {
      const { 
        clerkUserId, 
        email, 
        firstName, 
        lastName, 
        phone, 
        emailVerified = false,
        playerId,
        existingPlayer = false
      } = req.body;
      
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }
      
      let player;
      
      if (existingPlayer && playerId) {
        // Update existing player with Clerk data using direct PostgreSQL
        console.log(`🔄 [CLERK SYNC] Updating existing player ${playerId} with Clerk data`);
        
        const updateQuery = `
          UPDATE players 
          SET clerk_user_id = $1, 
              clerk_synced_at = NOW(), 
              email_verified = $2, 
              last_login_at = NOW()
          WHERE id = $3
          RETURNING *
        `;
        
        const result = await pgClient.query(updateQuery, [clerkUserId, emailVerified, playerId]);
        
        if (result.rows.length === 0) {
          throw new Error(`Player with ID ${playerId} not found`);
        }
        
        player = result.rows[0];
      } else {
        // Find existing player by email or create new one using direct PostgreSQL
        const findQuery = 'SELECT * FROM players WHERE email = $1';
        const findResult = await pgClient.query(findQuery, [email]);
        
        if (findResult.rows.length > 0) {
          // Update existing player
          console.log('🔄 [CLERK SYNC] Updating existing player by email:', email);
          
          const updateQuery = `
            UPDATE players 
            SET clerk_user_id = $1, 
                clerk_synced_at = NOW(), 
                email_verified = $2, 
                last_login_at = NOW()
            WHERE email = $3
            RETURNING *
          `;
          
          const updateResult = await pgClient.query(updateQuery, [clerkUserId, emailVerified, email]);
          player = updateResult.rows[0];
        } else {
          // Create new player from Clerk data
          console.log('✨ [CLERK SYNC] Creating new player from Clerk data:', email);
          
          const insertQuery = `
            INSERT INTO players (
              email, first_name, last_name, phone, clerk_user_id, clerk_synced_at,
              email_verified, last_login_at, kyc_status, balance, is_active,
              credit_approved, credit_limit, current_credit, total_deposits,
              total_withdrawals, total_winnings, total_losses, games_played,
              hours_played, total_rs_played, current_vip_points, 
              lifetime_vip_points, universal_id, password
            ) VALUES (
              $1, $2, $3, $4, $5, NOW(), $6, NOW(), 'pending', '0.00', true,
              false, 0, 0, '0.00', '0.00', '0.00', '0.00', 0, '0', 0, 0, 0,
              $7, 'clerk_managed'
            ) RETURNING *
          `;
          
          const universalId = `clerk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const insertResult = await pgClient.query(insertQuery, [
            email, firstName, lastName, phone, clerkUserId, emailVerified, universalId
          ]);
          
          player = insertResult.rows[0];
        }
      }
      
      // Log the sync operation
      await ClerkPlayerSync.logSyncOperation(pgClient, {
        playerId: player.id,
        clerkUserId,
        syncType: existingPlayer ? 'existing_player_sync' : 'manual_sync',
        syncData: { email, firstName, lastName, phone, emailVerified },
        success: true
      });
      
      console.log('✅ [CLERK SYNC] Player synced successfully:', player.id);
      
      res.status(200).json({ 
        success: true, 
        player: {
          id: player.id,
          email: player.email,
          firstName: player.first_name,
          lastName: player.last_name,
          clerkUserId: player.clerk_user_id,
          clerkSyncedAt: player.clerk_synced_at,
          emailVerified: player.email_verified,
          kycStatus: player.kyc_status,
          balance: player.balance
        },
        message: 'Player synced with Clerk successfully' 
      });
      
    } catch (error: any) {
      console.error('❌ [CLERK SYNC] Error syncing player:', error);
      
      // Log failed sync
      await ClerkPlayerSync.logSyncOperation(pgClient, {
        playerId: req.body.playerId,
        clerkUserId: req.body.clerkUserId,
        syncType: 'manual_sync',
        syncData: req.body,
        success: false,
        errorMessage: error.message
      });
      
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Sync failed' 
      });
    } finally {
      await pgClient.end();
    }
  }
  
  // Handle user.created webhook
  private static async handleUserCreated(pgClient: Client, event: ClerkWebhookEvent) {
    const userData = event.data;
    const email = userData.email_addresses?.[0]?.email_address;
    
    if (!email) {
      console.warn('⚠️ [CLERK WEBHOOK] No email found in user.created event');
      return;
    }
    
    console.log(`👤 [CLERK WEBHOOK] Processing user.created for: ${email}`);
    
    // Check if player already exists
    const findQuery = 'SELECT * FROM players WHERE email = $1';
    const findResult = await pgClient.query(findQuery, [email]);
      
    if (findResult.rows.length > 0) {
      // Update existing player with Clerk ID
      const updateQuery = `
        UPDATE players 
        SET clerk_user_id = $1, 
            clerk_synced_at = NOW(), 
            email_verified = $2
        WHERE email = $3
        RETURNING id
      `;
      
      const updateResult = await pgClient.query(updateQuery, [
        userData.id,
        userData.email_addresses?.[0]?.verification?.status === 'verified',
        email
      ]);
        
      console.log(`🔄 [CLERK WEBHOOK] Updated existing player: ${updateResult.rows[0]?.id}`);
    } else {
      // Create new player
      const insertQuery = `
        INSERT INTO players (
          email, first_name, last_name, phone, clerk_user_id, clerk_synced_at,
          email_verified, kyc_status, balance, is_active, credit_approved,
          credit_limit, current_credit, total_deposits, total_withdrawals,
          total_winnings, total_losses, games_played, hours_played,
          total_rs_played, current_vip_points, lifetime_vip_points,
          universal_id, password
        ) VALUES (
          $1, $2, $3, $4, $5, NOW(), $6, 'pending', '0.00', true, false,
          0, 0, '0.00', '0.00', '0.00', '0.00', 0, '0', 0, 0, 0, $7, 'clerk_managed'
        ) RETURNING id
      `;
      
      const universalId = `clerk_${userData.id}_${Date.now()}`;
      const insertResult = await pgClient.query(insertQuery, [
        email,
        userData.first_name || '',
        userData.last_name || '',
        userData.phone_numbers?.[0]?.phone_number || '',
        userData.id,
        userData.email_addresses?.[0]?.verification?.status === 'verified',
        universalId
      ]);
        
      console.log(`✅ [CLERK WEBHOOK] Created new player: ${insertResult.rows[0]?.id}`);
    }
  }
  
  // Handle user.updated webhook
  private static async handleUserUpdated(pgClient: Client, event: ClerkWebhookEvent) {
    const userData = event.data;
    const email = userData.email_addresses?.[0]?.email_address;
    
    if (!email) return;
    
    console.log(`🔄 [CLERK WEBHOOK] Processing user.updated for: ${email}`);
    
    const updateQuery = `
      UPDATE players 
      SET first_name = $1, 
          last_name = $2, 
          phone = $3, 
          email_verified = $4, 
          clerk_synced_at = NOW()
      WHERE clerk_user_id = $5
    `;
    
    await pgClient.query(updateQuery, [
      userData.first_name || '',
      userData.last_name || '',
      userData.phone_numbers?.[0]?.phone_number || '',
      userData.email_addresses?.[0]?.verification?.status === 'verified',
      userData.id
    ]);
  }
  
  // Handle user.deleted webhook
  private static async handleUserDeleted(pgClient: Client, event: ClerkWebhookEvent) {
    console.log(`🗑️ [CLERK WEBHOOK] Processing user.deleted for: ${event.data.id}`);
    
    const updateQuery = `
      UPDATE players 
      SET is_active = false, 
          clerk_synced_at = NOW()
      WHERE clerk_user_id = $1
    `;
    
    await pgClient.query(updateQuery, [event.data.id]);
  }
  
  // Log webhook events
  private static async logWebhookEvent(event: ClerkWebhookEvent) {
    const pgClient = await getPgClient();
    try {
      const logQuery = `
        INSERT INTO clerk_webhook_events (
          event_type, clerk_user_id, email, webhook_payload, success
        ) VALUES ($1, $2, $3, $4, $5)
      `;
      
      await pgClient.query(logQuery, [
        event.type,
        event.data.id,
        event.data.email_addresses?.[0]?.email_address,
        JSON.stringify(event),
        true
      ]);
    } catch (error) {
      console.error('❌ [CLERK WEBHOOK] Failed to log event:', error);
    } finally {
      await pgClient.end();
    }
  }
  
  // Log sync operations
  private static async logSyncOperation(pgClient: Client, data: {
    playerId?: number;
    clerkUserId?: string;
    syncType: string;
    syncData: any;
    success: boolean;
    errorMessage?: string;
  }) {
    try {
      const logQuery = `
        INSERT INTO clerk_sync_log (
          player_id, clerk_user_id, sync_type, sync_data, success, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      await pgClient.query(logQuery, [
        data.playerId,
        data.clerkUserId,
        data.syncType,
        JSON.stringify(data.syncData),
        data.success,
        data.errorMessage
      ]);
    } catch (error) {
      console.error('❌ [CLERK SYNC] Failed to log sync operation:', error);
    }
  }
}