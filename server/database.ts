import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  players, 
  playerPrefs, 
  tables, 
  seatRequests, 
  kycDocuments,
  type Player, 
  type InsertPlayer,
  type PlayerPrefs,
  type InsertPlayerPrefs,
  type Table,
  type SeatRequest,
  type InsertSeatRequest,
  type KycDocument,
  type InsertKycDocument
} from "@shared/schema";
import { eq, and } from 'drizzle-orm';
import type { IStorage } from './storage';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client);

export class DatabaseStorage implements IStorage {
  
  // Player operations
  async getPlayer(id: number): Promise<Player | undefined> {
    const result = await db.select().from(players).where(eq(players.id, id));
    return result[0];
  }

  async getPlayerByEmail(email: string): Promise<Player | undefined> {
    const result = await db.select().from(players).where(eq(players.email, email));
    return result[0];
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

  // Table operations
  async getTables(): Promise<Table[]> {
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

  // Initialize with sample data
  async initializeSampleData(): Promise<void> {
    // Check if tables already exist
    const existingTables = await db.select().from(tables);
    
    if (existingTables.length === 0) {
      // Insert sample tables
      await db.insert(tables).values([
        {
          name: "Table 1",
          gameType: "No Limit Hold'em",
          stakes: "$1/$2",
          maxPlayers: 9,
          currentPlayers: 7,
          pot: 142,
          avgStack: 380,
          isActive: true,
        },
        {
          name: "Table 2",
          gameType: "Pot Limit Omaha",
          stakes: "$2/$5",
          maxPlayers: 6,
          currentPlayers: 5,
          pot: 89,
          avgStack: 650,
          isActive: true,
        },
        {
          name: "Table 3",
          gameType: "Texas Hold'em",
          stakes: "$5/$10",
          maxPlayers: 9,
          currentPlayers: 8,
          pot: 420,
          avgStack: 1250,
          isActive: true,
        },
      ]);
    }
  }
}

export const dbStorage = new DatabaseStorage();