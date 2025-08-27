import { createClient } from '@supabase/supabase-js';
import type { IStorage } from './storage';
import type { Player, InsertPlayer, PlayerPrefs, InsertPlayerPrefs, Table, SeatRequest, InsertSeatRequest, KycDocument, InsertKycDocument, Transaction, InsertTransaction } from '@shared/schema';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

console.log('Supabase connection initialized - URL:', supabaseUrl);
console.log('Service role key exists:', !!supabaseServiceRoleKey);

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  db: { schema: 'public' },
  global: { headers: { 'Prefer': 'return=representation' } }
});

function mapSupabasePlayerToType(data: any): Player {
  return {
    id: data.id,
    supabaseId: data.supabase_id,
    universalId: data.universal_id,
    clerkUserId: data.clerk_user_id,
    email: data.email,
    password: data.password,
    firstName: data.first_name || '',
    lastName: data.last_name || '',
    phone: data.phone || '',
    kycStatus: data.kyc_status || 'pending',
    balance: data.balance || '0.00',
    totalDeposits: data.total_deposits || '0.00',
    totalWithdrawals: data.total_withdrawals || '0.00',
    totalWinnings: data.total_winnings || '0.00',
    totalLosses: data.total_losses || '0.00',
    gamesPlayed: data.games_played || 0,
    hoursPlayed: data.hours_played || '0.00',
    creditApproved: data.credit_approved || false,
    creditLimit: data.credit_limit || '0.00',
    currentCredit: data.current_credit || '0.00',
    panCardNumber: data.pan_card_number,
    panCardDocumentUrl: data.pan_card_document_url,
    panCardStatus: data.pan_card_status || 'missing',
    panCardVerified: data.pan_card_verified || false,
    panCardUploadedAt: data.pan_card_uploaded_at,
    isActive: data.is_active !== false,
    emailVerified: data.email_verified || false,
    lastLoginAt: data.last_login_at,
    clerkSyncedAt: data.clerk_synced_at,
    createdAt: data.created_at
  };
}

function mapSupabaseSeatRequestToType(data: any): SeatRequest {
  return {
    id: data.id,
    universalId: data.universal_id,
    playerId: data.player_id,
    tableId: data.table_id,
    status: data.status,
    position: data.position,
    seatNumber: data.seat_number,
    notes: data.notes,
    estimatedWait: data.estimated_wait,
    sessionStartTime: data.session_start_time,
    minPlayTime: data.min_play_time_minutes || 30,
    callTimeWindow: data.call_time_window_minutes || 10,
    callTimePlayPeriod: data.call_time_play_period_minutes || 5,
    cashoutWindow: data.cashout_window_minutes || 3,
    callTimeStarted: data.call_time_started,
    callTimeEnds: data.call_time_ends,
    cashoutWindowActive: data.cashout_window_active || false,
    cashoutWindowEnds: data.cashout_window_ends,
    lastCashoutAttempt: data.last_cashout_attempt,
    sessionBuyInAmount: data.session_buy_in_amount || '0.00',
    sessionCashOutAmount: data.session_cash_out_amount || '0.00',
    sessionRakeAmount: data.session_rake_amount || '0.00',
    sessionTipAmount: data.session_tip_amount || '0.00',
    createdAt: data.created_at
  };
}

export class SupabaseStorage implements IStorage {
  async getPlayer(id: number): Promise<Player | undefined> {
    console.log('SupabaseStorage: Searching for player with ID:', id);
    
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('SupabaseStorage: Error fetching player by ID:', error);
        return undefined;
      }
      
      console.log('SupabaseStorage: Found player by ID:', data);
      return mapSupabasePlayerToType(data);
    } catch (error) {
      console.error('SupabaseStorage: Exception in getPlayer:', error);
      return undefined;
    }
  }

  async getPlayerByEmail(email: string): Promise<Player | undefined> {
    console.log('SupabaseStorage: Searching for player with email:', email);
    
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('email', email)
        .single();
      
      if (error) {
        console.error('SupabaseStorage: Error fetching player by email:', error);
        return undefined;
      }
      
      console.log('SupabaseStorage: Found player data:', data);
      return mapSupabasePlayerToType(data);
    } catch (error) {
      console.error('SupabaseStorage: Exception in getPlayerByEmail:', error);
      return undefined;
    }
  }

  async getPlayerBySupabaseId(supabaseId: string): Promise<Player | undefined> {
    console.log('SupabaseStorage: Searching for player with supabase ID:', supabaseId);
    
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('supabase_id', supabaseId)
        .single();
      
      if (error) {
        console.error('SupabaseStorage: Error fetching player by supabase ID:', error);
        return undefined;
      }
      
      console.log('SupabaseStorage: Found player by supabase ID:', data);
      return mapSupabasePlayerToType(data);
    } catch (error) {
      console.error('SupabaseStorage: Exception in getPlayerBySupabaseId:', error);
      return undefined;
    }
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    console.log('SupabaseStorage: Creating player with data:', player);
    
    // Map to snake_case for Supabase with defaults for all fields
    const supabasePlayer = {
      supabase_id: player.supabaseId,
      email: player.email,
      password: player.password,
      first_name: player.firstName,
      last_name: player.lastName,
      phone: player.phone,
      kyc_status: player.kycStatus || 'pending'
    };
    
    console.log('SupabaseStorage: Inserting player data:', supabasePlayer);
    
    const { data, error } = await supabase
      .from('players')
      .insert(supabasePlayer)
      .select()
      .single();
    
    if (error) {
      console.error('SupabaseStorage: Error creating player:', error);
      throw new Error(`Failed to create player: ${error.message}`);
    }
    
    console.log('SupabaseStorage: Player created successfully:', data);
    return mapSupabasePlayerToType(data);
  }

  async getPlayerPrefs(playerId: number): Promise<PlayerPrefs | undefined> {
    const { data, error } = await supabase
      .from('player_prefs')
      .select('*')
      .eq('player_id', playerId)
      .single();
    
    if (error) return undefined;
    
    // Map from snake_case to camelCase
    return {
      id: data.id,
      playerId: data.player_id,
      seatAvailable: data.seat_available,
      callTimeWarning: data.call_time_warning,
      gameUpdates: data.game_updates
    };
  }

  async createPlayerPrefs(prefs: InsertPlayerPrefs): Promise<PlayerPrefs> {
    const supabasePrefs = {
      player_id: prefs.playerId,
      seat_available: prefs.seatAvailable,
      call_time_warning: prefs.callTimeWarning,
      game_updates: prefs.gameUpdates
    };

    const { data, error } = await supabase
      .from('player_prefs')
      .insert(supabasePrefs)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create player preferences: ${error.message}`);
    }

    return {
      id: data.id,
      playerId: data.player_id,
      seatAvailable: data.seat_available,
      callTimeWarning: data.call_time_warning,
      gameUpdates: data.game_updates
    };
  }

  async updatePlayerPrefs(playerId: number, updates: Partial<PlayerPrefs>): Promise<PlayerPrefs> {
    const supabaseUpdates: any = {};
    if (updates.seatAvailable !== undefined) supabaseUpdates.seat_available = updates.seatAvailable;
    if (updates.callTimeWarning !== undefined) supabaseUpdates.call_time_warning = updates.callTimeWarning;
    if (updates.gameUpdates !== undefined) supabaseUpdates.game_updates = updates.gameUpdates;

    const { data, error } = await supabase
      .from('player_prefs')
      .update(supabaseUpdates)
      .eq('player_id', playerId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update player preferences: ${error.message}`);
    }

    return {
      id: data.id,
      playerId: data.player_id,
      seatAvailable: data.seat_available,
      callTimeWarning: data.call_time_warning,
      gameUpdates: data.game_updates
    };
  }

  async getTables(): Promise<Table[]> {
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching tables:', error);
      return [];
    }

    return data?.map(table => ({
      id: table.id,
      name: table.name,
      gameType: table.game_type,
      stakes: table.stakes,
      maxPlayers: table.max_players,
      currentPlayers: table.current_players,
      pot: table.pot,
      avgStack: table.avg_stack,
      isActive: table.is_active
    })) || [];
  }

  async createSeatRequest(request: InsertSeatRequest): Promise<SeatRequest> {
    const supabaseRequest = {
      player_id: request.playerId,
      table_id: request.tableId,
      status: request.status || 'waiting',
      position: request.position,
      seat_number: request.seatNumber,
      notes: request.notes,
      estimated_wait: request.estimatedWait
    };

    const { data, error } = await supabase
      .from('seat_requests')
      .insert(supabaseRequest)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create seat request: ${error.message}`);
    }

    return mapSupabaseSeatRequestToType(data);
  }

  async getSeatRequestsByPlayer(playerId: number): Promise<SeatRequest[]> {
    const { data, error } = await supabase
      .from('seat_requests')
      .select('*')
      .eq('player_id', playerId);

    if (error) {
      console.error('Error fetching seat requests:', error);
      return [];
    }

    return data?.map(mapSupabaseSeatRequestToType) || [];
  }

  async createKycDocument(document: InsertKycDocument): Promise<KycDocument> {
    const supabaseDocument = {
      player_id: document.playerId,
      document_type: document.documentType,
      file_name: document.fileName,
      file_url: document.fileUrl,
      status: document.status || 'pending'
    };

    const { data, error } = await supabase
      .from('kyc_documents')
      .insert(supabaseDocument)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create KYC document: ${error.message}`);
    }

    return {
      id: data.id,
      playerId: data.player_id,
      documentType: data.document_type,
      fileName: data.file_name,
      fileUrl: data.file_url,
      status: data.status,
      createdAt: data.created_at
    };
  }

  async getKycDocumentsByPlayer(playerId: number): Promise<KycDocument[]> {
    const { data, error } = await supabase
      .from('kyc_documents')
      .select('*')
      .eq('player_id', playerId);

    if (error) {
      console.error('Error fetching KYC documents:', error);
      return [];
    }

    return data?.map(doc => ({
      id: doc.id,
      playerId: doc.player_id,
      documentType: doc.document_type,
      fileName: doc.file_name,
      fileUrl: doc.file_url,
      status: doc.status,
      createdAt: doc.created_at
    })) || [];
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const supabaseTransaction = {
      player_id: transaction.playerId,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      staff_id: transaction.staffId,
      status: transaction.status || 'completed',
      session_id: transaction.sessionId,
      table_id: transaction.tableId,
      table_name: transaction.tableName,
      session_event_type: transaction.sessionEventType,
      session_duration_minutes: transaction.sessionDuration,
      rake_percentage: transaction.rakePercentage,
      tip_recipient: transaction.tipRecipient
    };

    const { data, error } = await supabase
      .from('transactions')
      .insert(supabaseTransaction)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create transaction: ${error.message}`);
    }

    return {
      id: data.id,
      universalId: data.universal_id,
      playerId: data.player_id,
      type: data.type,
      amount: data.amount,
      description: data.description,
      staffId: data.staff_id,
      status: data.status,
      sessionId: data.session_id,
      tableId: data.table_id,
      tableName: data.table_name,
      sessionEventType: data.session_event_type,
      sessionDuration: data.session_duration_minutes,
      rakePercentage: data.rake_percentage,
      tipRecipient: data.tip_recipient,
      createdAt: data.created_at
    };
  }

  async getTransactionsByPlayer(playerId: number): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }

    return data?.map(t => ({
      id: t.id,
      universalId: t.universal_id,
      playerId: t.player_id,
      type: t.type,
      amount: t.amount,
      description: t.description,
      staffId: t.staff_id,
      status: t.status,
      sessionId: t.session_id,
      tableId: t.table_id,
      tableName: t.table_name,
      sessionEventType: t.session_event_type,
      sessionDuration: t.session_duration_minutes,
      rakePercentage: t.rake_percentage,
      tipRecipient: t.tip_recipient,
      createdAt: t.created_at
    })) || [];
  }

  async updatePlayerBalance(playerId: number, amount: string, type: 'deposit' | 'withdrawal' | 'win' | 'loss', description?: string, staffId?: string): Promise<Player> {
    // First get the current player
    const player = await this.getPlayer(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const currentBalance = parseFloat(player.balance);
    const transactionAmount = parseFloat(amount);
    
    let newBalance = currentBalance;
    const updates: any = { balance: currentBalance.toFixed(2) };

    switch (type) {
      case 'deposit':
        newBalance = currentBalance + transactionAmount;
        updates.total_deposits = (parseFloat(player.totalDeposits) + transactionAmount).toFixed(2);
        break;
      case 'withdrawal':
        newBalance = currentBalance - transactionAmount;
        updates.total_withdrawals = (parseFloat(player.totalWithdrawals) + transactionAmount).toFixed(2);
        break;
      case 'win':
        newBalance = currentBalance + transactionAmount;
        updates.total_winnings = (parseFloat(player.totalWinnings) + transactionAmount).toFixed(2);
        break;
      case 'loss':
        newBalance = currentBalance - transactionAmount;
        updates.total_losses = (parseFloat(player.totalLosses) + transactionAmount).toFixed(2);
        break;
    }

    updates.balance = newBalance.toFixed(2);

    // Update player in database
    const { data, error } = await supabase
      .from('players')
      .update(updates)
      .eq('id', playerId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update player balance: ${error.message}`);
    }

    // Record transaction
    await this.createTransaction({
      playerId,
      type,
      amount: amount,
      description,
      staffId,
      status: 'completed'
    });

    return mapSupabasePlayerToType(data);
  }

  async updatePlayerKycStatus(playerId: number, kycStatus: string): Promise<Player> {
    const { data, error } = await supabase
      .from('players')
      .update({ kyc_status: kycStatus })
      .eq('id', playerId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update player KYC status: ${error.message}`);
    }

    return mapSupabasePlayerToType(data);
  }

  async initializeSampleData(): Promise<void> {
    // Check if we already have data
    const { data: players } = await supabase.from('players').select('id').limit(1);
    
    if (players && players.length > 0) {
      console.log('Sample data already exists, skipping initialization');
      return;
    }

    console.log('Initializing sample data...');
    // Initialize with minimal test data if needed
  }
}

export const supabaseStorage = new SupabaseStorage();