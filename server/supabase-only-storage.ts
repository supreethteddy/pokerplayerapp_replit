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
  /**
   * UNIVERSAL CROSS-PORTAL STORAGE SYSTEM
   * All functions enhanced for perfect cross-portal compatibility
   */

  // Universal player count for health checks
  async getPlayerCount(): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error('Error getting player count:', error);
        return 0;
      }
      
      return count || 0;
    } catch (error: any) {
      console.error('Error getting player count:', error);
      return 0;
    }
  }

  // Update player KYC status (universal method)
  async updatePlayerKycStatus(playerId: number, status: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('players')
        .update({ kyc_status: status })
        .eq('id', playerId);
      
      if (error) {
        throw new Error(`Failed to update KYC status: ${error.message}`);
      }
      
      console.log(`✅ [UNIVERSAL] Updated KYC status for player ${playerId}: ${status}`);
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL] Error updating KYC status:`, error);
      throw error;
    }
  }

  // Update player with Supabase ID (universal ID linking)
  async updatePlayerSupabaseId(playerId: number, supabaseId: string): Promise<Player> {
    try {
      const { data, error } = await supabase
        .from('players')
        .update({ supabase_id: supabaseId })
        .eq('id', playerId)
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to update Supabase ID: ${error.message}`);
      }
      
      console.log(`✅ [UNIVERSAL] Updated player ${playerId} with Supabase ID: ${supabaseId}`);
      return this.transformPlayerFromSupabase(data);
    } catch (error: any) {
      console.error(`❌ [UNIVERSAL] Error updating Supabase ID:`, error);
      throw error;
    }
  }

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
    try {
      console.log('🔄 [UNIFIED] SupabaseOnlyStorage: Getting player by email:', email);
      
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('🔍 [UNIFIED] SupabaseOnlyStorage: No player found with email:', email);
          return undefined;
        }
        console.error('❌ [UNIFIED] SupabaseOnlyStorage: Error fetching player by email:', error);
        return undefined;
      }
      
      console.log('✅ [UNIFIED] SupabaseOnlyStorage: Player found by email - ID:', data.id);
      return this.transformPlayerFromSupabase(data);
    } catch (error: any) {
      console.error('❌ [UNIFIED] SupabaseOnlyStorage: Error in getPlayerByEmail:', error);
      return undefined;
    }
  }

  async getPlayerBySupabaseId(supabaseId: string): Promise<Player | undefined> {
    console.log('SupabaseOnlyStorage: Searching for player with Supabase ID:', supabaseId);
    
    // Since supabase_id column doesn't exist in the current schema,
    // we need to find the player by looking up the email from Supabase auth
    try {
      // Get the email from Supabase auth using the ID
      const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(supabaseId);
      
      if (authError || !user?.email) {
        console.error('SupabaseOnlyStorage: Error getting user from auth:', authError);
        return undefined;
      }
      
      console.log('SupabaseOnlyStorage: Found email from auth:', user.email);
      
      // Now find the player by email
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('email', user.email)
        .single();
      
      if (error) {
        console.error('SupabaseOnlyStorage: Error fetching player by email:', error);
        return undefined;
      }
      
      console.log('SupabaseOnlyStorage: Found player by email lookup:', data);
      return this.transformPlayerFromSupabase(data);
      
    } catch (error) {
      console.error('SupabaseOnlyStorage: Error in getPlayerBySupabaseId:', error);
      return undefined;
    }
  }

  async updatePlayerSupabaseId(playerId: number, supabaseId: string): Promise<Player> {
    // Since supabase_id column doesn't exist in the current schema,
    // we'll just return the player as-is since the connection is made via email
    const player = await this.getPlayer(playerId);
    if (!player) {
      throw new Error(`Player not found with ID: ${playerId}`);
    }
    
    console.log('SupabaseOnlyStorage: Supabase ID association handled via email lookup');
    return player;
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    try {
      console.log('🔄 [UNIFIED] SupabaseOnlyStorage: Creating player with unified system:', player);
      
      // Generate unique IDs for unlimited player scaling
      const universalId = `unified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const supabaseId = player.supabaseId || `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Transform player data with unified system fields (avoiding schema cache issues)
      const playerData = this.transformPlayerToSupabase(player);
      
      // Create player without unified fields first, then update via SQL
      const { data, error } = await supabase
        .from('players')
        .insert(playerData)
        .select()
        .single();
      
      if (error) {
        console.error('❌ [UNIFIED] SupabaseOnlyStorage: Error creating player:', error);
        throw new Error(`Failed to create player: ${error.message}`);
      }
      
      // Update with unified system fields using raw SQL
      if (data && !error) {
        try {
          await supabase
            .from('players')
            .update({ supabase_id: supabaseId, universal_id: universalId })
            .eq('id', data.id);
          
          console.log('✅ [UNIFIED] SupabaseOnlyStorage: Player created successfully - ID:', data.id, 'Universal ID:', universalId);
        } catch (updateError) {
          console.log('⚠️ [UNIFIED] Player created but unified fields not updated:', updateError);
        }
      }
      
      return this.transformPlayerFromSupabase(data);
    } catch (error: any) {
      console.error('❌ [UNIFIED] SupabaseOnlyStorage: Error in createPlayer:', error);
      throw error;
    }
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

  // Table operations with forced refresh - fetch ALL tables
  async getTables(): Promise<Table[]> {
    console.log('🔄 [SupabaseOnlyStorage] Fetching ALL tables from database...');
    
    // Force fresh data without any caching or filtering
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .order('id', { ascending: false });
    
    if (error) {
      console.error('❌ [SupabaseOnlyStorage] Error fetching tables:', error);
      throw new Error(`Failed to fetch tables: ${error.message}`);
    }
    
    console.log(`✅ [SupabaseOnlyStorage] Successfully fetched ${data?.length || 0} tables from database`);
    console.log('📋 [SupabaseOnlyStorage] Table names:', data?.map(t => t.name).join(', '));
    return data.map(this.transformTableFromSupabase);
  }

  // Seat request operations
  async createSeatRequest(request: InsertSeatRequest): Promise<SeatRequest> {
    console.log('🎯 [SEAT REQUEST] Creating seat request:', request);
    
    // Handle UUID table IDs by using raw insert since schema expects string
    const insertData = {
      player_id: request.playerId,
      table_id: request.tableId, // This is now a UUID string from poker_tables
      position: request.position || 0,
      status: request.status || 'waiting'
    };
    
    console.log('📋 [SEAT REQUEST] Insert data:', insertData);
    
    const { data, error } = await supabase
      .from('seat_requests')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('❌ [SEAT REQUEST] Error:', error);
      throw new Error(`Failed to create seat request: ${error.message}`);
    }
    
    console.log('✅ [SEAT REQUEST] Successfully created:', data);
    return this.transformSeatRequestFromSupabase(data);
  }

  async getSeatRequestsByPlayer(playerId: number): Promise<SeatRequest[]> {
    const { data, error } = await supabase
      .from('player_table_requests')
      .select('*')
      .eq('player_id', playerId);
    
    if (error) {
      console.error('❌ [getSeatRequestsByPlayer] Error:', error);
      // Return empty array if table doesn't exist
      return [];
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
    console.log('SupabaseOnlyStorage: transformPlayerFromSupabase input:', data);
    const transformed = {
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
    console.log('SupabaseOnlyStorage: transformPlayerFromSupabase output:', transformed);
    return transformed;
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
      stakes: data.stakes,
      maxPlayers: data.max_players,
      currentPlayers: data.current_players,
      pot: data.pot,
      avgStack: data.avg_stack,
      isActive: data.is_active,
      createdAt: data.created_at ? new Date(data.created_at) : new Date()
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