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
    
    // Map from snake_case to camelCase
    return {
      id: data.id,
      email: data.email,
      password: data.password,
      firstName: data.first_name,
      lastName: data.last_name,
      phone: data.phone,
      kycStatus: data.kyc_status,
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
    
    // Map from snake_case to camelCase
    return {
      id: data.id,
      email: data.email,
      password: data.password,
      firstName: data.first_name,
      lastName: data.last_name,
      phone: data.phone,
      kycStatus: data.kyc_status,
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
    
    // Map back to camelCase
    return {
      id: data.id,
      email: data.email,
      password: data.password,
      firstName: data.first_name,
      lastName: data.last_name,
      phone: data.phone,
      kycStatus: data.kyc_status,
      createdAt: data.created_at
    };
  }

  async getPlayerPrefs(playerId: number): Promise<PlayerPrefs | undefined> {
    const { data, error } = await supabase
      .from('player_prefs')
      .select('*')
      .eq('playerId', playerId)
      .single();
    
    if (error) return undefined;
    return data;
  }

  async createPlayerPrefs(prefs: InsertPlayerPrefs): Promise<PlayerPrefs> {
    const { data, error } = await supabase
      .from('player_prefs')
      .insert(prefs)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create player prefs: ${error.message}`);
    return data;
  }

  async updatePlayerPrefs(playerId: number, updates: Partial<PlayerPrefs>): Promise<PlayerPrefs> {
    const { data, error } = await supabase
      .from('player_prefs')
      .update(updates)
      .eq('playerId', playerId)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to update player prefs: ${error.message}`);
    return data;
  }

  async getTables(): Promise<Table[]> {
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .order('id');
    
    if (error) throw new Error(`Failed to get tables: ${error.message}`);
    return data || [];
  }

  async createSeatRequest(request: InsertSeatRequest): Promise<SeatRequest> {
    const { data, error } = await supabase
      .from('seat_requests')
      .insert(request)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create seat request: ${error.message}`);
    return data;
  }

  async getSeatRequestsByPlayer(playerId: number): Promise<SeatRequest[]> {
    const { data, error } = await supabase
      .from('seat_requests')
      .select('*')
      .eq('playerId', playerId)
      .order('createdAt', { ascending: false });
    
    if (error) throw new Error(`Failed to get seat requests: ${error.message}`);
    return data || [];
  }

  async createKycDocument(document: InsertKycDocument): Promise<KycDocument> {
    const { data, error } = await supabase
      .from('kyc_documents')
      .insert(document)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create KYC document: ${error.message}`);
    return data;
  }

  async initializeSampleData(): Promise<void> {
    try {
      // Check if tables already exist
      const { data: existingTables } = await supabase
        .from('tables')
        .select('id')
        .limit(1);
      
      if (existingTables && existingTables.length > 0) {
        return; // Sample data already exists
      }
      
      // Create sample tables with snake_case column names
      const sampleTables = [
        { name: "High Stakes Hold'em", game_type: "No Limit Hold'em", stakes: "$5/$10", max_players: 9, current_players: 6, status: "active", is_active: true },
        { name: "Omaha Action", game_type: "Pot Limit Omaha", stakes: "$2/$5", max_players: 8, current_players: 4, status: "active", is_active: true },
        { name: "Tournament Final", game_type: "No Limit Hold'em", stakes: "$1/$2", max_players: 6, current_players: 3, status: "active", is_active: true },
        { name: "Beginners Table", game_type: "No Limit Hold'em", stakes: "$0.50/$1", max_players: 10, current_players: 2, status: "waiting", is_active: true }
      ];
      
      await supabase.from('tables').insert(sampleTables);
    } catch (error) {
      console.log('Sample data initialization skipped:', error);
    }
  }
}

export const supabaseStorage = new SupabaseStorage();