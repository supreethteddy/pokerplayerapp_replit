import { db } from './db';
import { supabase } from './supabase';
import { players, seatRequests, transactions, syncActivityLog } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { cacheManager } from './cache-management';
import type { Player, InsertPlayer, Transaction, SeatRequest, InsertSyncActivityLog } from '../shared/schema';

/**
 * Enterprise-grade Universal System for cross-portal synchronization
 * Implements unified ID management and real-time data sync across all portals
 */
export class UniversalSystem {
  private static instance: UniversalSystem;

  static getInstance(): UniversalSystem {
    if (!UniversalSystem.instance) {
      UniversalSystem.instance = new UniversalSystem();
    }
    return UniversalSystem.instance;
  }

  /**
   * Generate enterprise-grade universal ID
   */
  generateUniversalId(): string {
    return crypto.randomUUID();
  }

  /**
   * Create player with unified ID system (Supabase ID + Universal ID)
   */
  async createPlayerWithUniversalId(playerData: InsertPlayer): Promise<Player> {
    try {
      console.log('🌐 [UniversalSystem] Creating player with universal ID system');
      
      // Generate universal ID for cross-portal sync
      const universalId = this.generateUniversalId();
      
      // Create player with both Supabase ID and Universal ID
      const [newPlayer] = await db
        .insert(players)
        .values({
          ...playerData,
          universalId,
        })
        .returning();

      // Log sync activity
      await this.logSyncActivity('player', 'create', universalId, newPlayer);

      console.log('✅ [UniversalSystem] Player created with universal ID:', {
        id: newPlayer.id,
        supabaseId: newPlayer.supabaseId,
        universalId: newPlayer.universalId
      });

      return newPlayer;
    } catch (error: any) {
      console.error('❌ [UniversalSystem] Error creating player:', error);
      throw error;
    }
  }

  /**
   * Get player by universal ID (cross-portal lookup)
   */
  async getPlayerByUniversalId(universalId: string): Promise<Player | undefined> {
    try {
      const [player] = await db
        .select()
        .from(players)
        .where(eq(players.universalId, universalId));

      return player;
    } catch (error: any) {
      console.error('❌ [UniversalSystem] Error getting player by universal ID:', error);
      throw error;
    }
  }

  /**
   * Create seat request with universal ID
   */
  async createSeatRequestWithUniversalId(seatRequestData: any): Promise<SeatRequest> {
    try {
      const universalId = this.generateUniversalId();
      
      const [newSeatRequest] = await db
        .insert(seatRequests)
        .values({
          ...seatRequestData,
          universalId,
        })
        .returning();

      // Log sync activity
      await this.logSyncActivity('seat_request', 'create', universalId, newSeatRequest);

      return newSeatRequest;
    } catch (error: any) {
      console.error('❌ [UniversalSystem] Error creating seat request:', error);
      throw error;
    }
  }

  /**
   * Create transaction with universal ID
   */
  async createTransactionWithUniversalId(transactionData: any): Promise<Transaction> {
    try {
      const universalId = this.generateUniversalId();
      
      const [newTransaction] = await db
        .insert(transactions)
        .values({
          ...transactionData,
          universalId,
        })
        .returning();

      // Log sync activity
      await this.logSyncActivity('transaction', 'create', universalId, newTransaction);

      return newTransaction;
    } catch (error: any) {
      console.error('❌ [UniversalSystem] Error creating transaction:', error);
      throw error;
    }
  }

  /**
   * Log sync activity for enterprise-grade audit trail
   */
  async logSyncActivity(
    entityType: string,
    action: string,
    entityUniversalId: string,
    entityData: any
  ): Promise<void> {
    try {
      const syncLog: InsertSyncActivityLog = {
        entityType,
        action,
        entityUniversalId,
        entityData,
        portalOrigin: 'player_portal',
      };

      await db.insert(syncActivityLog).values(syncLog);
      
      console.log(`📝 [UniversalSystem] Sync activity logged: ${entityType} ${action}`);
    } catch (error: any) {
      console.error('❌ [UniversalSystem] Error logging sync activity:', error);
      // Don't throw - logging shouldn't break main operations
    }
  }

  /**
   * Sync with external portals (Staff Portal, Master Admin)
   */
  async syncWithExternalPortals(entityType: string, entityData: any): Promise<void> {
    try {
      const syncPayload = {
        entityType,
        entityData,
        portalOrigin: 'player_portal',
        timestamp: new Date().toISOString(),
      };

      // Future: Add webhook/API calls to Staff Portal and Master Admin
      console.log('🔄 [UniversalSystem] External sync prepared:', syncPayload);
      
      // For now, just log the sync activity
      await this.logSyncActivity(entityType, 'external_sync', entityData.universalId, syncPayload);
    } catch (error: any) {
      console.error('❌ [UniversalSystem] Error syncing with external portals:', error);
      // Don't throw - external sync shouldn't break main operations
    }
  }

  /**
   * Add universal IDs to existing records (migration utility)
   */
  async migrateExistingRecords(): Promise<void> {
    try {
      console.log('🔄 [UniversalSystem] Starting migration of existing records');

      // Migrate players without universal IDs
      const playersWithoutUniversalId = await db
        .select()
        .from(players)
        .where(eq(players.universalId, null));

      for (const player of playersWithoutUniversalId) {
        const universalId = this.generateUniversalId();
        await db
          .update(players)
          .set({ universalId })
          .where(eq(players.id, player.id));
        
        console.log(`✅ [UniversalSystem] Added universal ID to player ${player.id}`);
      }

      // Migrate seat requests without universal IDs
      const seatRequestsWithoutUniversalId = await db
        .select()
        .from(seatRequests)
        .where(eq(seatRequests.universalId, null));

      for (const seatRequest of seatRequestsWithoutUniversalId) {
        const universalId = this.generateUniversalId();
        await db
          .update(seatRequests)
          .set({ universalId })
          .where(eq(seatRequests.id, seatRequest.id));
      }

      // Migrate transactions without universal IDs
      const transactionsWithoutUniversalId = await db
        .select()
        .from(transactions)
        .where(eq(transactions.universalId, null));

      for (const transaction of transactionsWithoutUniversalId) {
        const universalId = this.generateUniversalId();
        await db
          .update(transactions)
          .set({ universalId })
          .where(eq(transactions.id, transaction.id));
      }

      console.log('✅ [UniversalSystem] Migration completed successfully');
    } catch (error: any) {
      console.error('❌ [UniversalSystem] Error during migration:', error);
      throw error;
    }
  }

  /**
   * Universal health check for enterprise monitoring
   */
  async checkUniversalHealth(): Promise<any> {
    try {
      // Count players without universal IDs
      const playersWithoutUniversalId = await db
        .select()
        .from(players)
        .where(eq(players.universalId, null));

      // Count seat requests without universal IDs
      const seatRequestsWithoutUniversalId = await db
        .select()
        .from(seatRequests)
        .where(eq(seatRequests.universalId, null));

      // Count transactions without universal IDs
      const transactionsWithoutUniversalId = await db
        .select()
        .from(transactions)
        .where(eq(transactions.universalId, null));

      // Get total counts
      const totalPlayers = await db.select().from(players);
      const totalSeatRequests = await db.select().from(seatRequests);
      const totalTransactions = await db.select().from(transactions);

      return {
        status: 'Player Portal Universal System Active',
        universalIdCoverage: {
          players: {
            total: totalPlayers.length,
            withoutUniversalId: playersWithoutUniversalId.length,
            withUniversalId: totalPlayers.length - playersWithoutUniversalId.length,
          },
          seatRequests: {
            total: totalSeatRequests.length,
            withoutUniversalId: seatRequestsWithoutUniversalId.length,
            withUniversalId: totalSeatRequests.length - seatRequestsWithoutUniversalId.length,
          },
          transactions: {
            total: totalTransactions.length,
            withoutUniversalId: transactionsWithoutUniversalId.length,
            withUniversalId: totalTransactions.length - transactionsWithoutUniversalId.length,
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('❌ [UniversalSystem] Error checking universal health:', error);
      throw error;
    }
  }
}

export const universalSystem = UniversalSystem.getInstance();