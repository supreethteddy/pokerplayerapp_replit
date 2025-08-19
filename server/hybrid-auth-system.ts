import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client } from 'pg';

/**
 * HYBRID AUTHENTICATION SYSTEM
 * 
 * This system ensures complete integration between:
 * - Supabase Auth (primary authentication)
 * - Custom PostgreSQL players table (data storage)
 * - Clerk (secondary identity provider for Staff Portal sync)
 * 
 * Key Features:
 * 1. All users are created in Supabase Auth first
 * 2. Player data is stored in custom players table
 * 3. Clerk integration maintains cross-portal synchronization
 */

export interface HybridUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  metadata?: any;
}

export interface HybridAuthResult {
  success: boolean;
  supabaseUser?: any;
  playerData?: any;
  error?: string;
  needsEmailVerification?: boolean;
  redirectToKYC?: boolean;
}

export class HybridAuthSystem {
  private supabase: SupabaseClient;
  
  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  /**
   * CREATE HYBRID USER
   * 1. Create user in Supabase Auth
   * 2. Create player record in custom table
   * 3. Link both records via supabase_id
   */
  async createUser(userData: HybridUser): Promise<HybridAuthResult> {
    console.log(`🔐 [HYBRID AUTH] Creating user: ${userData.email}`);
    
    try {
      // STEP 1: Create user in Supabase Auth
      const { data: authUser, error: authError } = await this.supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: false, // We'll handle email verification manually
        user_metadata: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          phone: userData.phone || '',
          source: 'player_portal'
        }
      });

      if (authError || !authUser.user) {
        console.error('❌ [HYBRID AUTH] Supabase Auth creation failed:', authError);
        return { success: false, error: authError?.message || 'Failed to create auth user' };
      }

      console.log(`✅ [HYBRID AUTH] Supabase Auth user created: ${authUser.user.id}`);

      // STEP 2: Create player record in custom table
      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        const insertQuery = `
          INSERT INTO players (
            email, first_name, last_name, phone, password,
            supabase_id, kyc_status, balance, is_active,
            email_verified, created_at, credit_approved,
            credit_limit, current_credit, total_deposits,
            total_withdrawals, total_winnings, total_losses,
            games_played, hours_played, universal_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, 'pending', '0.00', true,
            false, NOW(), false, '0.00', '0.00', '0.00',
            '0.00', '0.00', '0.00', 0, '0.00', $7
          ) RETURNING *
        `;

        const universalId = `hybrid_${authUser.user.id}_${Date.now()}`;
        const result = await pgClient.query(insertQuery, [
          userData.email,
          userData.firstName,
          userData.lastName,
          userData.phone || '',
          userData.password, // Store for legacy compatibility
          authUser.user.id,
          universalId
        ]);

        const player = result.rows[0];
        console.log(`✅ [HYBRID AUTH] Player record created: ${player.id}`);

        return {
          success: true,
          supabaseUser: authUser.user,
          playerData: {
            id: player.id,
            email: player.email,
            firstName: player.first_name,
            lastName: player.last_name,
            phone: player.phone,
            kycStatus: player.kyc_status,
            balance: player.balance,
            supabaseId: player.supabase_id,
            universalId: player.universal_id,
            emailVerified: false
          },
          needsEmailVerification: true,
          redirectToKYC: true
        };

      } finally {
        await pgClient.end();
      }

    } catch (error: any) {
      console.error('❌ [HYBRID AUTH] User creation failed:', error);
      
      // Handle duplicate email
      if (error.code === '23505' && error.constraint === 'players_email_unique') {
        return await this.handleExistingUser(userData.email);
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * AUTHENTICATE USER
   * 1. Authenticate with Supabase Auth
   * 2. Fetch player data from custom table
   * 3. Return unified user object
   */
  async authenticateUser(email: string, password: string): Promise<HybridAuthResult> {
    console.log(`🔐 [HYBRID AUTH] Authenticating: ${email}`);

    try {
      // STEP 1: Authenticate with Supabase Auth
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error || !data.user) {
        console.log(`❌ [HYBRID AUTH] Supabase Auth failed: ${error?.message}`);
        return { success: false, error: 'Invalid credentials' };
      }

      console.log(`✅ [HYBRID AUTH] Supabase Auth successful: ${data.user.id}`);

      // STEP 2: Fetch player data
      const { data: player, error: playerError } = await this.supabase
        .from('players')
        .select('*')
        .eq('supabase_id', data.user.id)
        .single();

      if (playerError || !player) {
        console.log(`❌ [HYBRID AUTH] Player data not found for Supabase ID: ${data.user.id}`);
        return { success: false, error: 'Player data not found' };
      }

      console.log(`✅ [HYBRID AUTH] Player data found: ${player.id}`);

      return {
        success: true,
        supabaseUser: data.user,
        playerData: {
          id: player.id,
          email: player.email,
          firstName: player.first_name,
          lastName: player.last_name,
          phone: player.phone,
          kycStatus: player.kyc_status,
          balance: player.balance,
          emailVerified: data.user.email_confirmed_at ? true : false,
          creditBalance: player.current_credit || '0.00',
          creditLimit: player.credit_limit || '0.00',
          creditApproved: player.credit_approved || false,
          totalBalance: (parseFloat(player.balance || '0') + parseFloat(player.current_credit || '0')).toFixed(2)
        }
      };

    } catch (error: any) {
      console.error('❌ [HYBRID AUTH] Authentication failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * HANDLE EXISTING USER
   * Check if user exists and return appropriate response
   */
  private async handleExistingUser(email: string): Promise<HybridAuthResult> {
    console.log(`🔄 [HYBRID AUTH] Checking existing user: ${email}`);

    try {
      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        const result = await pgClient.query(
          'SELECT * FROM players WHERE email = $1', 
          [email]
        );

        if (result.rows.length > 0) {
          const player = result.rows[0];
          console.log(`✅ [HYBRID AUTH] Existing player found: ${player.kyc_status}`);

          return {
            success: true,
            playerData: {
              id: player.id,
              email: player.email,
              firstName: player.first_name,
              lastName: player.last_name,
              kycStatus: player.kyc_status,
              balance: player.balance,
              emailVerified: player.email_verified
            },
            redirectToKYC: player.kyc_status === 'pending',
            needsEmailVerification: !player.email_verified
          };
        }

        return { success: false, error: 'User not found' };

      } finally {
        await pgClient.end();
      }

    } catch (error: any) {
      console.error('❌ [HYBRID AUTH] Existing user check failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * SYNC WITH CLERK
   * Synchronize user data with Clerk for Staff Portal integration
   */
  async syncWithClerk(supabaseUserId: string, clerkUserId: string): Promise<boolean> {
    console.log(`🔄 [HYBRID AUTH] Syncing with Clerk: ${supabaseUserId} <-> ${clerkUserId}`);

    try {
      const { Client } = await import('pg');
      const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
      await pgClient.connect();

      try {
        await pgClient.query(
          `UPDATE players 
           SET clerk_user_id = $1, clerk_synced_at = NOW() 
           WHERE supabase_id = $2`,
          [clerkUserId, supabaseUserId]
        );

        console.log(`✅ [HYBRID AUTH] Clerk sync completed`);
        return true;

      } finally {
        await pgClient.end();
      }

    } catch (error) {
      console.error('❌ [HYBRID AUTH] Clerk sync failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const hybridAuthSystem = new HybridAuthSystem();