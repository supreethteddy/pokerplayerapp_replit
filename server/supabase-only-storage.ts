import { createClient } from '@supabase/supabase-js';
import type { IStorage } from './storage';
import type { 
  Player, 
  InsertPlayer, 
  PlayerPrefs, 
  InsertPlayerPrefs, 
  Table, 
  SeatRequest, 
  InsertSeatRequest, 
  KycDocument, 
  InsertKycDocument, 
  Transaction, 
  InsertTransaction 
} from '@shared/schema';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class SupabaseOnlyStorage implements IStorage {
  // Player operations
  async getPlayer(id: number): Promise<Player | undefined> {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error fetching player:', error);
      return undefined;
    }
    
    return this.transformPlayerFromSupabase(data);
  }

  async getPlayerByEmail(email: string): Promise<Player | undefined> {
    console.log('SupabaseOnlyStorage: Searching for player with email:', email);
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error) {
      console.error('SupabaseOnlyStorage: Error fetching player by email:', error);
      return undefined;
    }
    
    const player = this.transformPlayerFromSupabase(data);
    console.log('SupabaseOnlyStorage: Found player:', player);
    return player;
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    const { data, error } = await supabase
      .from('players')
      .insert(this.transformPlayerToSupabase(player))
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create player: ${error.message}`);
    }
    
    return this.transformPlayerFromSupabase(data);
  }

  async getAllPlayers(): Promise<Player[]> {
    const { data, error } = await supabase
      .from('players')
      .select('*');
    
    if (error) {
      throw new Error(`Failed to fetch players: ${error.message}`);
    }
    
    return data.map(this.transformPlayerFromSupabase);
  }

  // Player preferences operations
  async getPlayerPrefs(playerId: number): Promise<PlayerPrefs | undefined> {
    const { data, error } = await supabase
      .from('player_prefs')
      .select('*')
      .eq('player_id', playerId)
      .single();
    
    if (error) {
      console.error('Error fetching player preferences:', error);
      return undefined;
    }
    
    return this.transformPlayerPrefsFromSupabase(data);
  }

  async createPlayerPrefs(prefs: InsertPlayerPrefs): Promise<PlayerPrefs> {
    const { data, error } = await supabase
      .from('player_prefs')
      .insert(this.transformPlayerPrefsToSupabase(prefs))
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create player preferences: ${error.message}`);
    }
    
    return this.transformPlayerPrefsFromSupabase(data);
  }

  async updatePlayerPrefs(playerId: number, updates: Partial<PlayerPrefs>): Promise<PlayerPrefs> {
    const { data, error } = await supabase
      .from('player_prefs')
      .update(this.transformPlayerPrefsToSupabase(updates))
      .eq('player_id', playerId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to update player preferences: ${error.message}`);
    }
    
    return this.transformPlayerPrefsFromSupabase(data);
  }

  // Table operations
  async getTables(): Promise<Table[]> {
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .eq('is_active', true);
    
    if (error) {
      throw new Error(`Failed to fetch tables: ${error.message}`);
    }
    
    return data.map(this.transformTableFromSupabase);
  }

  // Seat request operations
  async createSeatRequest(request: InsertSeatRequest): Promise<SeatRequest> {
    const { data, error } = await supabase
      .from('seat_requests')
      .insert(this.transformSeatRequestToSupabase(request))
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create seat request: ${error.message}`);
    }
    
    return this.transformSeatRequestFromSupabase(data);
  }

  async getSeatRequestsByPlayer(playerId: number): Promise<SeatRequest[]> {
    const { data, error } = await supabase
      .from('seat_requests')
      .select('*')
      .eq('player_id', playerId);
    
    if (error) {
      throw new Error(`Failed to fetch seat requests: ${error.message}`);
    }
    
    return data.map(this.transformSeatRequestFromSupabase);
  }

  // KYC document operations
  async createKycDocument(document: InsertKycDocument): Promise<KycDocument> {
    const { data, error } = await supabase
      .from('kyc_documents')
      .insert(this.transformKycDocumentToSupabase(document))
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create KYC document: ${error.message}`);
    }
    
    return this.transformKycDocumentFromSupabase(data);
  }

  async getKycDocumentsByPlayer(playerId: number): Promise<KycDocument[]> {
    const { data, error } = await supabase
      .from('kyc_documents')
      .select('*')
      .eq('player_id', playerId);
    
    if (error) {
      throw new Error(`Failed to fetch KYC documents: ${error.message}`);
    }
    
    return data.map(this.transformKycDocumentFromSupabase);
  }

  // Transaction operations
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert(this.transformTransactionToSupabase(transaction))
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create transaction: ${error.message}`);
    }
    
    return this.transformTransactionFromSupabase(data);
  }

  async getTransactionsByPlayer(playerId: number): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('player_id', playerId);
    
    if (error) {
      throw new Error(`Failed to fetch transactions: ${error.message}`);
    }
    
    return data.map(this.transformTransactionFromSupabase);
  }

  async updatePlayerBalance(playerId: number, amount: string, type: 'deposit' | 'withdrawal' | 'win' | 'loss', description?: string, staffId?: string): Promise<Player> {
    // Get current player balance
    const currentPlayer = await this.getPlayer(playerId);
    if (!currentPlayer) {
      throw new Error('Player not found');
    }

    // Calculate new balance
    const currentBalance = parseFloat(currentPlayer.balance);
    const changeAmount = parseFloat(amount);
    let newBalance: number;

    switch (type) {
      case 'deposit':
      case 'win':
        newBalance = currentBalance + changeAmount;
        break;
      case 'withdrawal':
      case 'loss':
        newBalance = currentBalance - changeAmount;
        break;
      default:
        throw new Error('Invalid transaction type');
    }

    // Update player balance
    const { data, error } = await supabase
      .from('players')
      .update({ balance: newBalance.toFixed(2) })
      .eq('id', playerId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update player balance: ${error.message}`);
    }

    // Create transaction record
    await this.createTransaction({
      playerId,
      type,
      amount,
      description: description || `${type} transaction`,
      staffId: staffId || 'system'
    });

    return this.transformPlayerFromSupabase(data);
  }

  async updatePlayerKycStatus(playerId: number, kycStatus: string): Promise<Player> {
    // Use RPC to bypass the trigger if needed
    const { data, error } = await supabase
      .rpc('update_player_kyc_status', {
        player_id: playerId,
        new_kyc_status: kycStatus
      });

    if (error) {
      console.error('RPC update failed, trying direct update:', error.message);
      
      // Fallback to direct update without trigger
      const { data: directData, error: directError } = await supabase
        .from('players')
        .update({ kyc_status: kycStatus })
        .eq('id', playerId)
        .select()
        .single();

      if (directError) {
        throw new Error(`Failed to update player KYC status: ${directError.message}`);
      }

      return this.transformPlayerFromSupabase(directData);
    }

    // If RPC succeeded, get the updated player
    const updatedPlayer = await this.getPlayer(playerId);
    if (!updatedPlayer) {
      throw new Error('Player not found after KYC update');
    }

    return updatedPlayer;
  }

  // Transform functions to convert between Supabase snake_case and camelCase
  private transformPlayerFromSupabase(data: any): Player {
    return {
      id: data.id,
      email: data.email,
      password: data.password,
      firstName: data.first_name,
      lastName: data.last_name,
      phone: data.phone,
      kycStatus: data.kyc_status,
      balance: data.balance,
      totalDeposits: data.total_deposits,
      totalWithdrawals: data.total_withdrawals,
      totalWinnings: data.total_winnings,
      totalLosses: data.total_losses,
      gamesPlayed: data.games_played,
      hoursPlayed: data.hours_played,
      createdAt: new Date(data.created_at)
    };
  }

  private transformPlayerToSupabase(player: any): any {
    return {
      email: player.email,
      password: player.password,
      first_name: player.firstName,
      last_name: player.lastName,
      phone: player.phone,
      kyc_status: player.kycStatus || 'pending',
      balance: player.balance || '0.00',
      total_deposits: player.totalDeposits || '0.00',
      total_withdrawals: player.totalWithdrawals || '0.00',
      total_winnings: player.totalWinnings || '0.00',
      total_losses: player.totalLosses || '0.00',
      games_played: player.gamesPlayed || 0,
      hours_played: player.hoursPlayed || '0.00'
    };
  }

  private transformPlayerPrefsFromSupabase(data: any): PlayerPrefs {
    return {
      id: data.id,
      playerId: data.player_id,
      seatAvailable: data.seat_available,
      soundEnabled: data.sound_enabled,
      emailNotifications: data.email_notifications,
      autoRebuy: data.auto_rebuy,
      rebuyThreshold: data.rebuy_threshold,
      maxRebuyAmount: data.max_rebuy_amount,
      createdAt: new Date(data.created_at)
    };
  }

  private transformPlayerPrefsToSupabase(prefs: any): any {
    return {
      player_id: prefs.playerId,
      seat_available: prefs.seatAvailable,
      sound_enabled: prefs.soundEnabled,
      email_notifications: prefs.emailNotifications,
      auto_rebuy: prefs.autoRebuy,
      rebuy_threshold: prefs.rebuyThreshold,
      max_rebuy_amount: prefs.maxRebuyAmount
    };
  }

  private transformTableFromSupabase(data: any): Table {
    return {
      id: data.id,
      name: data.name,
      gameType: data.game_type,
      minBuyIn: data.min_buy_in,
      maxBuyIn: data.max_buy_in,
      smallBlind: data.small_blind,
      bigBlind: data.big_blind,
      maxPlayers: data.max_players,
      currentPlayers: data.current_players,
      isActive: data.is_active,
      createdAt: new Date(data.created_at)
    };
  }

  private transformSeatRequestFromSupabase(data: any): SeatRequest {
    return {
      id: data.id,
      playerId: data.player_id,
      tableId: data.table_id,
      status: data.status,
      position: data.position,
      createdAt: new Date(data.created_at)
    };
  }

  private transformSeatRequestToSupabase(request: any): any {
    return {
      player_id: request.playerId,
      table_id: request.tableId,
      status: request.status || 'pending',
      position: request.position || 1
    };
  }

  private transformKycDocumentFromSupabase(data: any): KycDocument {
    return {
      id: data.id,
      playerId: data.player_id,
      documentType: data.document_type,
      fileName: data.file_name,
      fileUrl: data.file_url,
      status: data.status,
      createdAt: new Date(data.created_at)
    };
  }

  private transformKycDocumentToSupabase(document: any): any {
    return {
      player_id: document.playerId,
      document_type: document.documentType,
      file_name: document.fileName,
      file_url: document.fileUrl,
      status: document.status || 'pending'
    };
  }

  private transformTransactionFromSupabase(data: any): Transaction {
    return {
      id: data.id,
      playerId: data.player_id,
      type: data.type,
      amount: data.amount,
      description: data.description,
      staffId: data.staff_id,
      createdAt: new Date(data.created_at)
    };
  }

  private transformTransactionToSupabase(transaction: any): any {
    return {
      player_id: transaction.playerId,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      staff_id: transaction.staffId
    };
  }
}

export const supabaseOnlyStorage = new SupabaseOnlyStorage();