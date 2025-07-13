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

export interface IStorage {
  // Player operations
  getPlayer(id: number): Promise<Player | undefined>;
  getPlayerByEmail(email: string): Promise<Player | undefined>;
  createPlayer(player: InsertPlayer): Promise<Player>;
  
  // Player preferences operations
  getPlayerPrefs(playerId: number): Promise<PlayerPrefs | undefined>;
  createPlayerPrefs(prefs: InsertPlayerPrefs): Promise<PlayerPrefs>;
  updatePlayerPrefs(playerId: number, updates: Partial<PlayerPrefs>): Promise<PlayerPrefs>;
  
  // Table operations
  getTables(): Promise<Table[]>;
  
  // Seat request operations
  createSeatRequest(request: InsertSeatRequest): Promise<SeatRequest>;
  getSeatRequestsByPlayer(playerId: number): Promise<SeatRequest[]>;
  
  // KYC document operations
  createKycDocument(document: InsertKycDocument): Promise<KycDocument>;
}

export class MemStorage implements IStorage {
  private players: Map<number, Player> = new Map();
  private playerPrefs: Map<number, PlayerPrefs> = new Map();
  private tables: Map<number, Table> = new Map();
  private seatRequests: Map<number, SeatRequest> = new Map();
  private kycDocuments: Map<number, KycDocument> = new Map();
  
  private currentPlayerId = 1;
  private currentPrefsId = 1;
  private currentTableId = 1;
  private currentRequestId = 1;
  private currentDocumentId = 1;

  constructor() {
    // Initialize with some sample tables
    this.initializeTables();
  }

  private initializeTables() {
    const sampleTables: Table[] = [
      {
        id: 1,
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
        id: 2,
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
        id: 3,
        name: "Table 3",
        gameType: "Texas Hold'em",
        stakes: "$5/$10",
        maxPlayers: 9,
        currentPlayers: 8,
        pot: 420,
        avgStack: 1250,
        isActive: true,
      },
    ];

    sampleTables.forEach(table => {
      this.tables.set(table.id, table);
      this.currentTableId = Math.max(this.currentTableId, table.id + 1);
    });
  }

  // Player operations
  async getPlayer(id: number): Promise<Player | undefined> {
    return this.players.get(id);
  }

  async getPlayerByEmail(email: string): Promise<Player | undefined> {
    return Array.from(this.players.values()).find(player => player.email === email);
  }

  async createPlayer(insertPlayer: InsertPlayer): Promise<Player> {
    const id = this.currentPlayerId++;
    const player: Player = { 
      ...insertPlayer, 
      id,
      kycStatus: insertPlayer.kycStatus || "pending",
      createdAt: new Date(),
    };
    this.players.set(id, player);
    return player;
  }

  // Player preferences operations
  async getPlayerPrefs(playerId: number): Promise<PlayerPrefs | undefined> {
    return Array.from(this.playerPrefs.values()).find(prefs => prefs.playerId === playerId);
  }

  async createPlayerPrefs(insertPrefs: InsertPlayerPrefs): Promise<PlayerPrefs> {
    const id = this.currentPrefsId++;
    const prefs: PlayerPrefs = {
      id,
      playerId: insertPrefs.playerId || null,
      seatAvailable: insertPrefs.seatAvailable ?? true,
      callTimeWarning: insertPrefs.callTimeWarning ?? true,
      gameUpdates: insertPrefs.gameUpdates ?? false,
    };
    this.playerPrefs.set(id, prefs);
    return prefs;
  }

  async updatePlayerPrefs(playerId: number, updates: Partial<PlayerPrefs>): Promise<PlayerPrefs> {
    const existingPrefs = await this.getPlayerPrefs(playerId);
    if (!existingPrefs) {
      throw new Error('Player preferences not found');
    }
    
    const updatedPrefs = { ...existingPrefs, ...updates };
    this.playerPrefs.set(existingPrefs.id, updatedPrefs);
    return updatedPrefs;
  }

  // Table operations
  async getTables(): Promise<Table[]> {
    return Array.from(this.tables.values()).filter(table => table.isActive);
  }

  // Seat request operations
  async createSeatRequest(insertRequest: InsertSeatRequest): Promise<SeatRequest> {
    const id = this.currentRequestId++;
    const request: SeatRequest = {
      id,
      playerId: insertRequest.playerId || null,
      tableId: insertRequest.tableId || null,
      status: insertRequest.status || "waiting",
      position: insertRequest.position || 1,
      estimatedWait: insertRequest.estimatedWait || 15,
      createdAt: new Date(),
    };
    this.seatRequests.set(id, request);
    return request;
  }

  async getSeatRequestsByPlayer(playerId: number): Promise<SeatRequest[]> {
    return Array.from(this.seatRequests.values()).filter(request => request.playerId === playerId);
  }

  // KYC document operations
  async createKycDocument(insertDocument: InsertKycDocument): Promise<KycDocument> {
    const id = this.currentDocumentId++;
    const document: KycDocument = {
      id,
      playerId: insertDocument.playerId || null,
      documentType: insertDocument.documentType,
      fileName: insertDocument.fileName,
      fileUrl: insertDocument.fileUrl,
      status: insertDocument.status || "pending",
      createdAt: new Date(),
    };
    this.kycDocuments.set(id, document);
    return document;
  }
}

export const storage = new MemStorage();
