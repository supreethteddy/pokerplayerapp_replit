import { createClient } from '@supabase/supabase-js';
import type { IStorage } from './storage';
import type { Player, InsertPlayer, PlayerPrefs, InsertPlayerPrefs, Table, SeatRequest, InsertSeatRequest, KycDocument, InsertKycDocument } from '@shared/schema';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export class SupabaseStorage implements IStorage {
  async getPlayer(id: number): Promise<Player | undefined> {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) return undefined;
    
    // Map from snake_case to camelCase - include all player fields
    return {
      id: data.id,
      email: data.email,
      password: data.password || '',
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
      createdAt: data.created_at
    };
  }

  async getPlayerByEmail(email: string): Promise<Player | undefined> {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error) return undefined;
    
    // Map from snake_case to camelCase - include all player fields
    return {
      id: data.id,
      email: data.email,
      password: data.password || '',
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
      createdAt: data.created_at
    };
  }

  async createPlayer(player: InsertPlayer): Promise<Player> {
    // Map to snake_case for Supabase
    const supabasePlayer = {
      email: player.email,
      password: player.password,
      first_name: player.firstName,
      last_name: player.lastName,
      phone: player.phone,
      kyc_status: player.kycStatus || 'pending',
      created_at: player.createdAt || new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('players')
      .insert(supabasePlayer)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create player: ${error.message}`);
    
    // Map back to camelCase - include all player fields
    return {
      id: data.id,
      email: data.email,
      password: data.password || '',
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
      createdAt: data.created_at
    };
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
    // Map to snake_case for Supabase
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
    
    if (error) throw new Error(`Failed to create player prefs: ${error.message}`);
    
    // Map back to camelCase
    return {
      id: data.id,
      playerId: data.player_id,
      seatAvailable: data.seat_available,
      callTimeWarning: data.call_time_warning,
      gameUpdates: data.game_updates
    };
  }

  async updatePlayerPrefs(playerId: number, updates: Partial<PlayerPrefs>): Promise<PlayerPrefs> {
    // Map to snake_case for Supabase
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
    
    if (error) throw new Error(`Failed to update player prefs: ${error.message}`);
    
    // Map back to camelCase
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
      .eq('is_active', true)
      .order('id');
    
    if (error) {
      // If tables table doesn't exist, return empty array (no mock data)
      // This will be populated by your real poker room management system
      console.log('Tables table not found in Supabase - awaiting real poker room data connection');
      return [];
    }
    
    // Map from snake_case to camelCase
    return (data || []).map(item => ({
      id: item.id,
      name: item.name,
      gameType: item.game_type,
      stakes: item.stakes,
      maxPlayers: item.max_players,
      currentPlayers: item.current_players,
      pot: item.pot,
      avgStack: item.avg_stack,
      isActive: item.is_active
    }));
  }

  async createSeatRequest(request: InsertSeatRequest): Promise<SeatRequest> {
    // Map to snake_case for Supabase
    const supabaseRequest = {
      player_id: request.playerId,
      table_id: request.tableId,
      status: request.status || 'waiting',
      position: request.position || 0,
      estimated_wait: request.estimatedWait || 0,
      created_at: request.createdAt || new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('seat_requests')
      .insert(supabaseRequest)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create seat request: ${error.message}`);
    
    // Map back to camelCase
    return {
      id: data.id,
      playerId: data.player_id,
      tableId: data.table_id,
      status: data.status,
      position: data.position,
      estimatedWait: data.estimated_wait,
      createdAt: data.created_at
    };
  }

  async getSeatRequestsByPlayer(playerId: number): Promise<SeatRequest[]> {
    const { data, error } = await supabase
      .from('seat_requests')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });
    
    if (error) {
      // If seat_requests table doesn't exist, return empty array
      console.log('Seat requests table not found in Supabase - awaiting real poker room data connection');
      return [];
    }
    
    // Map from snake_case to camelCase
    return (data || []).map(item => ({
      id: item.id,
      playerId: item.player_id,
      tableId: item.table_id,
      status: item.status,
      position: item.position,
      estimatedWait: item.estimated_wait,
      createdAt: item.created_at
    }));
  }

  async createKycDocument(document: InsertKycDocument): Promise<KycDocument> {
    // Map to snake_case for Supabase
    const supabaseDocument = {
      player_id: document.playerId,
      document_type: document.documentType,
      file_name: document.fileName,
      file_url: document.fileUrl,
      status: document.status || 'pending',
      created_at: document.createdAt || new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('kyc_documents')
      .insert(supabaseDocument)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create KYC document: ${error.message}`);
    
    // Map back to camelCase
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
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });
    
    if (error) {
      // If kyc_documents table doesn't exist, return empty array
      console.log('KYC documents table not found in Supabase - awaiting real poker room data connection');
      return [];
    }
    
    // Map from snake_case to camelCase
    return (data || []).map(item => ({
      id: item.id,
      playerId: item.player_id,
      documentType: item.document_type,
      fileName: item.file_name,
      fileUrl: item.file_url,
      status: item.status,
      createdAt: item.created_at
    }));
  }

  async initializeSampleData(): Promise<void> {
    // Production mode - no mock data initialization
    // Tables will be populated from your real poker room management system
    console.log('Supabase connection initialized - no mock data in production');
  }
}

export const supabaseStorage = new SupabaseStorage();