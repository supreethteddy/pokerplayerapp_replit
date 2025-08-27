import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase for authentication operations
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface EnterprisePlayer {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  clerkUserId?: string;
  supabaseUserId?: string;
  password?: string;
  metadata?: Record<string, any>;
}

export interface BulkCreateResult {
  success: boolean;
  created: number;
  failed: number;
  results: Array<{
    email: string;
    playerId?: number;
    error?: string;
    status: 'created' | 'exists' | 'error';
  }>;
  totalTime: number;
}

export class EnterprisePlayerSystem {
  private batchSize = 1000; // Process in batches of 1000 for optimal performance
  
  // Get PostgreSQL client pool for high-performance operations
  private async getPgClient(): Promise<Client> {
    const client = new Client({
      connectionString: process.env.SUPABASE_DATABASE_URL,
      connectionTimeoutMillis: 10000, // 10 seconds instead of 2
      query_timeout: 10000, // 10 seconds query timeout
      statement_timeout: 10000, // 10 seconds statement timeout
    });
    await client.connect();
    return client;
  }

  // Enterprise-grade single player creation with full optimization
  async createSinglePlayer(playerData: EnterprisePlayer): Promise<{ 
    playerId: number; 
    status: 'created' | 'exists' | 'updated';
    message: string;
  }> {
    console.log('🏢 [ENTERPRISE] Creating single player:', playerData.email);
    
    const pgClient = await this.getPgClient();
    
    try {
      // Check if player exists first (optimized query)
      const existsQuery = 'SELECT id, email, clerk_user_id FROM players WHERE email = $1';
      const existsResult = await pgClient.query(existsQuery, [playerData.email]);
      
      if (existsResult.rows.length > 0) {
        const existingPlayer = existsResult.rows[0];
        
        // Update existing player if Clerk ID is provided
        if (playerData.clerkUserId && !existingPlayer.clerk_user_id) {
          const updateQuery = `
            UPDATE players 
            SET clerk_user_id = $1,
                first_name = COALESCE($2, first_name),
                last_name = COALESCE($3, last_name),
                phone = COALESCE($4, phone),
                clerk_synced_at = NOW(),
                last_login_at = NOW()
            WHERE id = $5
            RETURNING id
          `;
          
          await pgClient.query(updateQuery, [
            playerData.clerkUserId,
            playerData.firstName,
            playerData.lastName,
            playerData.phone,
            existingPlayer.id
          ]);
          
          console.log('✅ [ENTERPRISE] Updated existing player:', existingPlayer.id);
          return {
            playerId: existingPlayer.id,
            status: 'updated',
            message: 'Player updated with new authentication data'
          };
        }
        
        return {
          playerId: existingPlayer.id,
          status: 'exists',
          message: 'Player already exists'
        };
      }
      
      // Create new player with optimized insert
      const universalId = `enterprise_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const insertQuery = `
        INSERT INTO players (
          email, first_name, last_name, phone, clerk_user_id, supabase_id,
          password, universal_id, kyc_status, balance, is_active,
          credit_approved, credit_limit, current_credit, total_deposits,
          total_withdrawals, total_winnings, total_losses, games_played,
          hours_played, total_rs_played, current_vip_points, 
          lifetime_vip_points, email_verified, clerk_synced_at, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 'pending', '0.00', true,
          false, 0, 0, '0.00', '0.00', '0.00', '0.00', 0, '0', 0, 0, 0,
          $9, NOW(), NOW()
        ) RETURNING id, email, first_name, last_name
      `;
      
      const result = await pgClient.query(insertQuery, [
        playerData.email,
        playerData.firstName || '',
        playerData.lastName || '',
        playerData.phone || '',
        playerData.clerkUserId || null,
        playerData.supabaseUserId || null,
        playerData.password || 'auto_generated',
        universalId,
        !!playerData.clerkUserId // email_verified if Clerk user
      ]);
      
      const newPlayer = result.rows[0];
      console.log('✅ [ENTERPRISE] Created new player:', newPlayer.id);
      
      return {
        playerId: newPlayer.id,
        status: 'created',
        message: 'Player created successfully'
      };
      
    } catch (error: any) {
      console.error('❌ [ENTERPRISE] Player creation failed:', error);
      throw error;
    } finally {
      await pgClient.end();
    }
  }

  // Enterprise-grade bulk player creation for 10,000+ players
  async createBulkPlayers(players: EnterprisePlayer[]): Promise<BulkCreateResult> {
    const startTime = Date.now();
    console.log(`🏢 [ENTERPRISE BULK] Starting bulk creation of ${players.length} players`);
    
    const results: BulkCreateResult['results'] = [];
    let created = 0;
    let failed = 0;
    
    // Process in optimized batches
    for (let i = 0; i < players.length; i += this.batchSize) {
      const batch = players.slice(i, i + this.batchSize);
      console.log(`🔄 [ENTERPRISE BULK] Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(players.length / this.batchSize)}`);
      
      const batchResults = await this.processBatch(batch);
      results.push(...batchResults);
      
      // Count results
      batchResults.forEach(result => {
        if (result.status === 'created') created++;
        else if (result.status === 'error') failed++;
      });
      
      // Small delay between batches to prevent overwhelming the database
      if (i + this.batchSize < players.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ [ENTERPRISE BULK] Completed: ${created} created, ${failed} failed in ${totalTime}ms`);
    
    return {
      success: failed === 0,
      created,
      failed,
      results,
      totalTime
    };
  }

  // Process a batch of players with transaction safety
  private async processBatch(batch: EnterprisePlayer[]): Promise<BulkCreateResult['results']> {
    const pgClient = await this.getPgClient();
    const results: BulkCreateResult['results'] = [];
    
    try {
      // Start transaction for batch consistency
      await pgClient.query('BEGIN');
      
      for (const player of batch) {
        try {
          // Check if player exists
          const existsQuery = 'SELECT id FROM players WHERE email = $1';
          const existsResult = await pgClient.query(existsQuery, [player.email]);
          
          if (existsResult.rows.length > 0) {
            results.push({
              email: player.email,
              playerId: existsResult.rows[0].id,
              status: 'exists'
            });
            continue;
          }
          
          // Create new player
          const universalId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          const insertQuery = `
            INSERT INTO players (
              email, first_name, last_name, phone, clerk_user_id, supabase_id,
              password, universal_id, kyc_status, balance, is_active,
              credit_approved, credit_limit, current_credit, total_deposits,
              total_withdrawals, total_winnings, total_losses, games_played,
              hours_played, total_rs_played, current_vip_points, 
              lifetime_vip_points, email_verified, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, 'pending', '0.00', true,
              false, 0, 0, '0.00', '0.00', '0.00', '0.00', 0, '0', 0, 0, 0,
              $9, NOW()
            ) RETURNING id
          `;
          
          const insertResult = await pgClient.query(insertQuery, [
            player.email,
            player.firstName || '',
            player.lastName || '',
            player.phone || '',
            player.clerkUserId || null,
            player.supabaseUserId || null,
            player.password || 'bulk_generated',
            universalId,
            !!player.clerkUserId
          ]);
          
          results.push({
            email: player.email,
            playerId: insertResult.rows[0].id,
            status: 'created'
          });
          
        } catch (error: any) {
          results.push({
            email: player.email,
            error: error.message,
            status: 'error'
          });
        }
      }
      
      // Commit transaction
      await pgClient.query('COMMIT');
      
    } catch (error: any) {
      await pgClient.query('ROLLBACK');
      console.error('❌ [ENTERPRISE BULK] Batch failed:', error);
      
      // Mark all as failed
      batch.forEach(player => {
        if (!results.find(r => r.email === player.email)) {
          results.push({
            email: player.email,
            error: 'Batch transaction failed',
            status: 'error'
          });
        }
      });
    } finally {
      await pgClient.end();
    }
    
    return results;
  }

  // Generate test data for bulk operations
  generateTestPlayers(count: number): EnterprisePlayer[] {
    const players: EnterprisePlayer[] = [];
    
    for (let i = 0; i < count; i++) {
      players.push({
        email: `testuser${i + 1}@poker-enterprise.com`,
        firstName: `User${i + 1}`,
        lastName: `Test`,
        phone: `+1${(1000000000 + i).toString().slice(0, 10)}`,
        metadata: { bulkTest: true, batch: Math.floor(i / this.batchSize) }
      });
    }
    
    return players;
  }

  // Health check for enterprise operations
  async healthCheck(): Promise<{
    databaseConnected: boolean;
    supabaseConnected: boolean;
    performanceMetrics: {
      connectionTime: number;
      queryTime: number;
    };
  }> {
    const startTime = Date.now();
    
    try {
      // Test database connection
      const pgClient = await this.getPgClient();
      const dbConnectTime = Date.now() - startTime;
      
      // Test query performance
      const queryStart = Date.now();
      await pgClient.query('SELECT COUNT(*) FROM players');
      const queryTime = Date.now() - queryStart;
      
      await pgClient.end();
      
      // Test Supabase connection
      const { data, error } = await supabase
        .from('players')
        .select('count')
        .limit(1);
      
      return {
        databaseConnected: true,
        supabaseConnected: !error,
        performanceMetrics: {
          connectionTime: dbConnectTime,
          queryTime
        }
      };
      
    } catch (error) {
      return {
        databaseConnected: false,
        supabaseConnected: false,
        performanceMetrics: {
          connectionTime: -1,
          queryTime: -1
        }
      };
    }
  }
}

export const enterprisePlayerSystem = new EnterprisePlayerSystem();