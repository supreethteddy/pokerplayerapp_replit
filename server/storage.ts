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
  
  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getTransactionsByPlayer(playerId: number): Promise<Transaction[]>;
  updatePlayerBalance(playerId: number, amount: string, type: 'deposit' | 'withdrawal' | 'win' | 'loss', description?: string, staffId?: string): Promise<Player>;
}

export class MemStorage implements IStorage {
  private players: Map<number, Player> = new Map();
  private playerPrefs: Map<number, PlayerPrefs> = new Map();
  private tables: Map<number, Table> = new Map();
  private seatRequests: Map<number, SeatRequest> = new Map();
  private kycDocuments: Map<number, KycDocument> = new Map();
  private transactions: Map<number, Transaction> = new Map();
  
  private currentPlayerId = 1;
  private currentPrefsId = 1;
  private currentTableId = 1;
  private currentRequestId = 1;
  private currentDocumentId = 1;
  private currentTransactionId = 1;

  constructor() {
    // Initialize with some sample tables
    this.initializeTables();
  }

  private initializeTables() {
    // Clean initialization - no mock data
    // Tables will be populated by the poker room management system
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
      balance: "0.00",
      totalDeposits: "0.00",
      totalWithdrawals: "0.00",
      totalWinnings: "0.00",
      totalLosses: "0.00",
      gamesPlayed: 0,
      hoursPlayed: "0.00",
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

  // Transaction operations
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = this.currentTransactionId++;
    const transaction: Transaction = {
      id,
      playerId: insertTransaction.playerId || null,
      type: insertTransaction.type,
      amount: insertTransaction.amount,
      description: insertTransaction.description,
      staffId: insertTransaction.staffId,
      status: insertTransaction.status || "completed",
      createdAt: new Date(),
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async getTransactionsByPlayer(playerId: number): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(t => t.playerId === playerId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async updatePlayerBalance(playerId: number, amount: string, type: 'deposit' | 'withdrawal' | 'win' | 'loss', description?: string, staffId?: string): Promise<Player> {
    const player = await this.getPlayer(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const currentBalance = parseFloat(player.balance);
    const transactionAmount = parseFloat(amount);
    
    let newBalance = currentBalance;
    let updatedPlayer = { ...player };

    switch (type) {
      case 'deposit':
        newBalance += transactionAmount;
        updatedPlayer.totalDeposits = (parseFloat(player.totalDeposits) + transactionAmount).toFixed(2);
        break;
      case 'withdrawal':
        newBalance -= transactionAmount;
        updatedPlayer.totalWithdrawals = (parseFloat(player.totalWithdrawals) + transactionAmount).toFixed(2);
        break;
      case 'win':
        newBalance += transactionAmount;
        updatedPlayer.totalWinnings = (parseFloat(player.totalWinnings) + transactionAmount).toFixed(2);
        break;
      case 'loss':
        newBalance -= transactionAmount;
        updatedPlayer.totalLosses = (parseFloat(player.totalLosses) + transactionAmount).toFixed(2);
        break;
    }

    updatedPlayer.balance = newBalance.toFixed(2);
    this.players.set(playerId, updatedPlayer);

    // Record transaction
    await this.createTransaction({
      playerId,
      type,
      amount: amount,
      description,
      staffId,
      status: 'completed'
    });

    return updatedPlayer;
  }
}

export const storage = new MemStorage();
