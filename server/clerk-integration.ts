// Clerk Integration for Player Portal
// Maps Clerk users to existing Player ID system

import { createClient } from '@supabase/supabase-js';

interface ClerkUserData {
  clerkUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export class ClerkPlayerSync {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // Find or create player with Clerk user ID mapping
  async syncPlayer(userData: ClerkUserData) {
    try {
      console.log('🔗 [CLERK SYNC] Syncing player:', userData.email);

      // First, check if player already exists with this Clerk ID
      let { data: existingPlayer, error: findError } = await this.supabase
        .from('players')
        .select('*')
        .eq('clerk_user_id', userData.clerkUserId)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        throw findError;
      }

      if (existingPlayer) {
        console.log('✅ [CLERK SYNC] Found existing player:', existingPlayer.id);
        return this.transformPlayer(existingPlayer);
      }

      // Check if player exists by email (for migration from Supabase auth)
      const { data: emailPlayer, error: emailError } = await this.supabase
        .from('players')
        .select('*')
        .eq('email', userData.email)
        .single();

      if (emailError && emailError.code !== 'PGRST116') {
        throw emailError;
      }

      if (emailPlayer) {
        // Migrate existing Supabase user to Clerk
        console.log('🔄 [CLERK SYNC] Migrating existing player to Clerk:', emailPlayer.id);
        
        const { data: updatedPlayer, error: updateError } = await this.supabase
          .from('players')
          .update({ clerk_user_id: userData.clerkUserId })
          .eq('id', emailPlayer.id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        console.log('✅ [CLERK SYNC] Player migrated to Clerk:', updatedPlayer.id);
        return this.transformPlayer(updatedPlayer);
      }

      // Create new player for new Clerk user
      console.log('➕ [CLERK SYNC] Creating new player for Clerk user');
      
      const { v4: uuidv4 } = await import('uuid');
      const newPlayer = {
        clerk_user_id: userData.clerkUserId,
        universal_id: uuidv4(),
        email: userData.email,
        first_name: userData.firstName,
        last_name: userData.lastName,
        phone: userData.phone || '',
        kyc_status: 'pending',
        balance: '0.00',
        total_deposits: '0.00',
        total_withdrawals: '0.00',
        total_winnings: '0.00',
        total_losses: '0.00',
        games_played: 0,
        hours_played: '0.00',
        credit_eligible: false,
        is_active: true
      };

      const { data: createdPlayer, error: createError } = await this.supabase
        .from('players')
        .insert(newPlayer)
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      console.log('✅ [CLERK SYNC] New player created:', createdPlayer.id);
      return this.transformPlayer(createdPlayer);

    } catch (error) {
      console.error('❌ [CLERK SYNC] Error syncing player:', error);
      throw error;
    }
  }

  // Transform Supabase player to match frontend AuthUser interface
  private transformPlayer(supabasePlayer: any) {
    return {
      id: supabasePlayer.id,
      email: supabasePlayer.email,
      firstName: supabasePlayer.first_name,
      lastName: supabasePlayer.last_name,
      phone: supabasePlayer.phone || '',
      kycStatus: supabasePlayer.kyc_status || 'pending',
      balance: supabasePlayer.balance || '0.00',
      totalDeposits: supabasePlayer.total_deposits || '0.00',
      totalWithdrawals: supabasePlayer.total_withdrawals || '0.00',
      totalWinnings: supabasePlayer.total_winnings || '0.00',
      totalLosses: supabasePlayer.total_losses || '0.00',
      gamesPlayed: supabasePlayer.games_played || 0,
      hoursPlayed: supabasePlayer.hours_played || '0.00',
      createdAt: supabasePlayer.created_at
    };
  }

  // Update player phone number after KYC
  async updatePlayerPhone(clerkUserId: string, phone: string) {
    try {
      const { data, error } = await this.supabase
        .from('players')
        .update({ phone })
        .eq('clerk_user_id', clerkUserId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.transformPlayer(data);
    } catch (error) {
      console.error('❌ [CLERK SYNC] Error updating player phone:', error);
      throw error;
    }
  }

  // Update KYC status
  async updateKycStatus(clerkUserId: string, kycStatus: string) {
    try {
      const { data, error } = await this.supabase
        .from('players')
        .update({ kyc_status: kycStatus })
        .eq('clerk_user_id', clerkUserId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.transformPlayer(data);
    } catch (error) {
      console.error('❌ [CLERK SYNC] Error updating KYC status:', error);
      throw error;
    }
  }
}