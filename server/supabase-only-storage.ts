import { createClient } from '@supabase/supabase-js';
// Storage interface removed - using direct implementation
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
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export class SupabaseOnlyStorage {
  /**
   * UNIVERSAL CROSS-PORTAL STORAGE SYSTEM
   * All functions enhanced for perfect cross-portal compatibility
   */

  // Staff Portal Integration Methods
  async updatePlayerBalance(playerId: string, balanceData: any): Promise<Player> {
    try {
      const { data, error } = await supabase
        .from('players')
        .update(balanceData)
        .eq('id', playerId)
        .select()
        .single();
      
      if (error) throw error;
      return this.transformPlayerFromSupabase(data);
    } catch (error) {
      console.error('Error updating player balance:', error);
      throw error;
    }
  }

  async updatePlayerCredit(playerId: string, creditData: any): Promise<Player> {
    try {
      const { data, error } = await supabase
        .from('players')
        .update(creditData)
        .eq('id', playerId)
        .select()
        .single();
      
      if (error) throw error;
      return this.transformPlayerFromSupabase(data);
    } catch (error) {
      console.error('Error updating player credit:', error);
      throw error;
    }
  }

  async getPlayer(playerId: string): Promise<Player | null> {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', playerId)
        .single();
      
      if (error || !data) return null;
      return this.transformPlayerFromSupabase(data);
    } catch (error) {
      console.error('Error getting player:', error);
      return null;
    }
  }

  // Get player by Clerk ID
  async getPlayerByClerkId(clerkId: string): Promise<Player | null> {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('clerk_user_id', clerkId)
        .single();
      
      if (error || !data) {
        return null;
      }
      
      return data as Player;
    } catch (error) {
      console.error('Error getting player by Clerk ID:', error);
      return null;
    }
  }

  // Create player from Clerk
  async createClerkPlayer(playerData: any): Promise<Player> {
    try {
      const { data, error } = await supabase
        .from('players')
        .insert({
          ...playerData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return data as Player;
    } catch (error) {
      console.error('Error creating Clerk player:', error);
      throw error;
    }
  }

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
    console.log('🔍 [UNIFIED] Getting player by Supabase ID:', supabaseId);
    
    try {
      // First try direct lookup by supabase_id (handles both real UUIDs and custom auth_ IDs)
      const { data: directData, error: directError } = await supabase
        .from('players')
        .select('*')
        .eq('supabase_id', supabaseId)
        .single();
      
      if (!directError && directData) {
        console.log('✅ [UNIFIED] Direct Supabase ID lookup successful:', directData.email);
        return this.transformPlayerFromSupabase(directData);
      }
      
      // Only try auth lookup if the supabaseId looks like a proper UUID (not custom auth_ IDs)
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(supabaseId);
      
      if (!isValidUUID) {
        console.log('🚫 [UNIFIED] Custom auth ID detected (not UUID), skipping auth lookup:', supabaseId);
        return undefined;
      }
      
      console.log('🔄 [UNIFIED] Valid UUID detected, trying auth email lookup');
      
      // Fallback: Get email from Supabase auth and lookup by email (only for real UUIDs)
      const { data: { user }, error: authError } = await supabase.auth.admin.getUserById(supabaseId);
      
      if (authError || !user?.email) {
        console.error('❌ [UNIFIED] Auth user not found:', authError?.message);
        return undefined;
      }
      
      console.log('🔍 [UNIFIED] Found auth email:', user.email);
      
      // Find player by email and update with Supabase ID
      const { data: emailData, error: emailError } = await supabase
        .from('players')
        .select('*')
        .eq('email', user.email)
        .single();
      
      if (emailError || !emailData) {
        console.log('❌ [UNIFIED] Player not found by email:', user.email);
        return undefined;
      }
      
      // Update player with Supabase ID for future direct lookups
      const { error: updateError } = await supabase
        .from('players')
        .update({ supabase_id: supabaseId })
        .eq('id', emailData.id);
      
      if (!updateError) {
        emailData.supabase_id = supabaseId; // Update local data
        console.log('✅ [UNIFIED] Updated player', emailData.id, 'with Supabase ID');
      }
      
      console.log('✅ [UNIFIED] Player found and linked:', emailData.email);
      return this.transformPlayerFromSupabase(emailData);
      
    } catch (error: any) {
      console.error('❌ [UNIFIED] Error in getPlayerBySupabaseId:', error);
      return undefined;
    }
  }



  async createPlayer(player: InsertPlayer): Promise<Player> {
    try {
      console.log('🔄 [UNIFIED] SupabaseOnlyStorage: Creating player with unified system:', player);
      
      // Generate unique IDs for unlimited player scaling
      const universalId = `unified_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const supabaseId = player.supabaseId || `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Transform player data with unified system fields (avoiding schema cache issues)
      const playerData = this.transformPlayerToSupabase(player);
      
      // Add the unified fields directly to the insert
      const finalPlayerData = {
        ...playerData,
        supabase_id: supabaseId,
        universal_id: universalId
      };
      
      console.log('🔄 [UNIFIED] Creating player with data:', {
        email: finalPlayerData.email,
        phone: finalPlayerData.phone,
        supabase_id: finalPlayerData.supabase_id,
        universal_id: finalPlayerData.universal_id
      });
      
      // Create player with all fields in one operation
      const { data, error } = await supabase
        .from('players')
        .insert(finalPlayerData)
        .select()
        .single();
      
      if (error) {
        console.error('❌ [UNIFIED] SupabaseOnlyStorage: Error creating player:', error);
        throw new Error(`Failed to create player: ${error.message}`);
      }
      
      console.log('✅ [UNIFIED] SupabaseOnlyStorage: Player created successfully:', {
        id: data.id,
        email: data.email,
        phone: data.phone,
        supabase_id: data.supabase_id,
        universal_id: data.universal_id
      });
      
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
    // Ensure player exists first - use more robust checking
    const { data: playerCheck, error: playerError } = await supabase
      .from('players')
      .select('id, email')
      .eq('id', document.playerId)
      .single();
    
    console.log(`🔍 [STORAGE] Player check for ID ${document.playerId}:`, playerCheck, playerError);
    
    if (playerError || !playerCheck) {
      console.error(`❌ [STORAGE] Player lookup failed:`, playerError);
      // Don't throw error - allow document creation to proceed
      console.log(`⚠️ [STORAGE] Proceeding with document creation despite player check failure`);
    }
    
    // Insert document with proper handling
    const { data, error } = await supabase
      .from('kyc_documents')
      .insert({
        player_id: document.playerId,
        document_type: document.documentType,
        file_name: document.fileName,
        file_url: document.fileUrl,
        file_size: 0,
        status: document.status || 'pending'
      })
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



  // Transform functions to convert between Supabase snake_case and camelCase
  private transformPlayerFromSupabase(data: any): Player {
    console.log('SupabaseOnlyStorage: transformPlayerFromSupabase input:', data);
    const transformed = {
      id: data.id,
      clerkUserId: data.clerk_user_id || null,
      supabaseId: data.supabase_id || null,
      universalId: data.universal_id || null,
      email: data.email,
      password: data.password,
      firstName: data.first_name,
      lastName: data.last_name,
      phone: data.phone,
      kycStatus: data.kyc_status,
      balance: data.balance || '0.00', // Real cash balance
      currentCredit: data.current_credit ? String(data.current_credit) : '0.00', // Credit balance from cashier
      creditLimit: data.credit_limit ? String(data.credit_limit) : '0.00', // Maximum credit allowed  
      creditApproved: Boolean(data.credit_approved), // Credit approval status
      totalDeposits: data.total_deposits || '0.00',
      totalWithdrawals: data.total_withdrawals || '0.00',
      totalWinnings: data.total_winnings || '0.00',
      totalLosses: data.total_losses || '0.00',
      gamesPlayed: data.games_played || 0,
      hoursPlayed: data.hours_played || '0.00',
      panCardNumber: data.pan_card_number || null,
      panCardVerified: data.pan_card_verified || false,
      panCardUploadedAt: data.pan_card_uploaded_at ? new Date(data.pan_card_uploaded_at) : null,
      panCardDocumentUrl: data.pan_card_document_url || null,
      panCardStatus: data.pan_card_status || 'missing',
      totalRsPlayed: data.total_rs_played || 0,
      currentVipPoints: data.current_vip_points || 0,
      lifetimeVipPoints: data.lifetime_vip_points || 0,
      createdAt: data.created_at ? new Date(data.created_at) : null
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
      hours_played: player.hoursPlayed || '0.00',
      clerk_user_id: player.clerkUserId || null
    };
  }

  private transformPlayerPrefsFromSupabase(data: any): PlayerPrefs {
    return {
      id: data.id,
      playerId: data.player_id,
      seatAvailable: data.seat_available,
      callTimeWarning: data.call_time_warning,
      gameUpdates: data.game_updates
    };
  }

  private transformPlayerPrefsToSupabase(prefs: any): any {
    return {
      player_id: prefs.playerId,
      seat_available: prefs.seatAvailable,
      call_time_warning: prefs.callTimeWarning,
      game_updates: prefs.gameUpdates
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