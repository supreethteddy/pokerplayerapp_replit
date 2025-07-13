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
    
    // Map from Supabase schema to our schema
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
    
    // Map from Supabase schema to our schema
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
    // Map the schema to match Supabase column names
    const supabasePlayer = {
      email: player.email,
      password: player.password,
      first_name: player.firstName,
      last_name: player.lastName,
      phone: player.phone,
      kyc_status: player.kycStatus,
      created_at: player.createdAt
    };
    
    const { data, error } = await supabase
      .from('players')
      .insert(supabasePlayer)
      .select()
      .single();
    
    if (error) throw new Error(`Failed to create player: ${error.message}`);
    
    // Map back to our schema
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
    // Check if tables already exist
    const { data: existingTables } = await supabase
      .from('tables')
      .select('id')
      .limit(1);
    
    if (existingTables && existingTables.length > 0) {
      return; // Sample data already exists
    }
    
    // Create sample tables
    const sampleTables = [
      { name: "High Stakes Hold'em", gameType: "No Limit Hold'em", stakes: "$5/$10", maxPlayers: 9, currentPlayers: 6, status: "active" },
      { name: "Omaha Action", gameType: "Pot Limit Omaha", stakes: "$2/$5", maxPlayers: 8, currentPlayers: 4, status: "active" },
      { name: "Tournament Final", gameType: "No Limit Hold'em", stakes: "$1/$2", maxPlayers: 6, currentPlayers: 3, status: "active" },
      { name: "Beginners Table", gameType: "No Limit Hold'em", stakes: "$0.50/$1", maxPlayers: 10, currentPlayers: 2, status: "waiting" }
    ];
    
    await supabase.from('tables').insert(sampleTables);
  }
}

export const supabaseStorage = new SupabaseStorage();