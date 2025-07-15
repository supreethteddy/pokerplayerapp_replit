import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  players, 
  playerPrefs, 
  tables, 
  seatRequests, 
  kycDocuments,
  transactions,
  type Player, 
  type InsertPlayer,
  type PlayerPrefs,
  type InsertPlayerPrefs,
  type Table,
  type SeatRequest,
  type InsertSeatRequest,
  type KycDocument,
  type InsertKycDocument,
  type Transaction,
  type InsertTransaction
} from "@shared/schema";
import { eq, and } from 'drizzle-orm';
import type { IStorage } from './storage';

// SUPABASE ONLY - Neon database permanently disabled
const connectionString = "postgresql://postgres.oyhnpnymlezjusnwpjeu:Shetty1234%21%40%23-@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
console.log('🔗 Connected to Supabase database (Neon disabled)');
const client = postgres(connectionString);
export const db = drizzle(client);

export class DatabaseStorage implements IStorage {
  
  // Player operations
  async getPlayer(id: number): Promise<Player | undefined> {
    const result = await db.select().from(players).where(eq(players.id, id));
    return result[0];
  }

  async getPlayerByEmail(email: string): Promise<Player | undefined> {
    console.log('DatabaseStorage: Searching for player with email:', email);
    try {
      const result = await db.select().from(players).where(eq(players.email, email));
      console.log('DatabaseStorage: Found player:', result[0]);
      return result[0];
    } catch (error) {
      console.error('DatabaseStorage: Error fetching player by email:', error);
      return undefined;
    }
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const result = await db.insert(players).values(player).returning();
    return result[0];
  }

  // Player preferences operations
  async getPlayerPrefs(playerId: number): Promise<PlayerPrefs | undefined> {
    const result = await db.select().from(playerPrefs).where(eq(playerPrefs.playerId, playerId));
    return result[0];
  }

  async createPlayerPrefs(prefs: InsertPlayerPrefs): Promise<PlayerPrefs> {
    const result = await db.insert(playerPrefs).values(prefs).returning();
    return result[0];
  }

  async updatePlayerPrefs(playerId: number, updates: Partial<PlayerPrefs>): Promise<PlayerPrefs> {
    const result = await db.update(playerPrefs)
      .set(updates)
      .where(eq(playerPrefs.playerId, playerId))
      .returning();
    
    if (result.length === 0) {
      throw new Error('Player preferences not found');
    }
    
    return result[0];
  }

  // Table operations - Connect to your real poker room management system
  async getTables(): Promise<Table[]> {
    // TODO: Replace this with your actual poker room management system API
    // This should connect to your live poker room software that manages:
    // - Active tables and games
    // - Real-time player counts
    // - Live pot amounts and stack sizes
    // - Current game states and betting rounds
    
    // For now, returning empty array (no mock data)
    // Once you provide your poker room management system details, 
    // this will be updated to fetch real-time data
    
    const result = await db.select().from(tables).where(eq(tables.isActive, true));
    return result;
  }

  // Seat request operations
  async createSeatRequest(request: InsertSeatRequest): Promise<SeatRequest> {
    const result = await db.insert(seatRequests).values(request).returning();
    return result[0];
  }

  async getSeatRequestsByPlayer(playerId: number): Promise<SeatRequest[]> {
    const result = await db.select().from(seatRequests).where(eq(seatRequests.playerId, playerId));
    return result;
  }

  // KYC document operations
  async createKycDocument(document: InsertKycDocument): Promise<KycDocument> {
    const result = await db.insert(kycDocuments).values(document).returning();
    return result[0];
  }

  async getKycDocumentsByPlayer(playerId: number): Promise<KycDocument[]> {
    console.log('DatabaseStorage: Getting KYC documents for player ID:', playerId);
    try {
      const result = await db.select().from(kycDocuments).where(eq(kycDocuments.playerId, playerId));
      console.log('DatabaseStorage: Found KYC documents:', result);
      return result;
    } catch (error) {
      console.error('DatabaseStorage: Error getting KYC documents:', error);
      return [];
    }
  }

  // Transaction operations
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const result = await db.insert(transactions).values(transaction).returning();
    return result[0];
  }

  async getTransactionsByPlayer(playerId: number): Promise<Transaction[]> {
    const result = await db.select().from(transactions).where(eq(transactions.playerId, playerId));
    return result;
  }

  async updatePlayerBalance(playerId: number, amount: string, type: 'deposit' | 'withdrawal' | 'win' | 'loss', description?: string, staffId?: string): Promise<Player> {
    const player = await this.getPlayer(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const currentBalance = parseFloat(player.balance);
    const transactionAmount = parseFloat(amount);
    
    let newBalance = currentBalance;
    let updatedStats: any = {};

    switch (type) {
      case 'deposit':
        newBalance += transactionAmount;
        updatedStats.totalDeposits = (parseFloat(player.totalDeposits) + transactionAmount).toFixed(2);
        break;
      case 'withdrawal':
        newBalance -= transactionAmount;
        updatedStats.totalWithdrawals = (parseFloat(player.totalWithdrawals) + transactionAmount).toFixed(2);
        break;
      case 'win':
        newBalance += transactionAmount;
        updatedStats.totalWinnings = (parseFloat(player.totalWinnings) + transactionAmount).toFixed(2);
        break;
      case 'loss':
        newBalance -= transactionAmount;
        updatedStats.totalLosses = (parseFloat(player.totalLosses) + transactionAmount).toFixed(2);
        break;
    }

    // Update player balance and stats
    const result = await db.update(players)
      .set({
        balance: newBalance.toFixed(2),
        ...updatedStats
      })
      .where(eq(players.id, playerId))
      .returning();

    // Record transaction
    await this.createTransaction({
      playerId,
      type,
      amount: amount,
      description,
      staffId,
      status: 'completed'
    });

    return result[0];
  }

  // Initialize with sample data
  async initializeSampleData(): Promise<void> {
    // Clean initialization - no mock data
    // Tables will be populated by the poker room management system
  }
}

export const dbStorage = new DatabaseStorage();