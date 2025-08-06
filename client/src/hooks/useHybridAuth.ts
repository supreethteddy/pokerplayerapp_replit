import { useUser } from '@clerk/clerk-react';
import { useAuth } from './useAuth';
import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import type { AuthUser } from './useAuth';

// Hybrid authentication hook that works with both Clerk and Supabase
export function useHybridAuth() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { user: supabaseUser, loading: supabaseLoading, signOut: supabaseSignOut } = useAuth();
  const [hybridUser, setHybridUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync Clerk user with our player database
  const syncClerkUser = async (clerkUserId: string, email: string) => {
    try {
      const response = await fetch('/api/clerk/sync-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkUserId,
          email,
          firstName: clerkUser?.firstName || '',
          lastName: clerkUser?.lastName || ''
        })
      });

      const data = await response.json();
      if (data.player) {
        const transformedUser: AuthUser = {
          id: data.player.id.toString(),
          email: data.player.email,
          firstName: data.player.firstName,
          lastName: data.player.lastName,
          phone: data.player.phone || '',
          kycStatus: data.player.kycStatus || 'pending',
          balance: data.player.balance || '0.00',
          totalDeposits: data.player.totalDeposits || '0.00',
          totalWithdrawals: data.player.totalWithdrawals || '0.00',
          totalWinnings: data.player.totalWinnings || '0.00',
          totalLosses: data.player.totalLosses || '0.00',
          gamesPlayed: data.player.gamesPlayed || 0,
          hoursPlayed: data.player.hoursPlayed || '0.00'
        };
        setHybridUser(transformedUser);
        return transformedUser;
      }
    } catch (error) {
      console.error('Failed to sync Clerk user:', error);
      throw error;
    }
  };

  // Effect to handle authentication state
  useEffect(() => {
    const handleAuth = async () => {
      if (!clerkLoaded || supabaseLoading) {
        return;
      }

      try {
        if (clerkUser) {
          // Clerk user is authenticated
          const email = clerkUser.primaryEmailAddress?.emailAddress;
          if (email) {
            await syncClerkUser(clerkUser.id, email);
          }
        } else if (supabaseUser) {
          // Supabase user is authenticated
          setHybridUser(supabaseUser);
        } else {
          // No user authenticated
          setHybridUser(null);
        }
      } catch (error) {
        console.error('Auth error:', error);
        setHybridUser(null);
      } finally {
        setLoading(false);
      }
    };

    handleAuth();
  }, [clerkUser, supabaseUser, clerkLoaded, supabaseLoading]);

  // Unified sign out
  const signOut = async () => {
    try {
      if (clerkUser) {
        // Clerk sign out will be handled by ClerkProvider
        window.location.reload();
      } else {
        await supabaseSignOut();
      }
      setHybridUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return {
    user: hybridUser,
    loading,
    isAuthenticated: !!hybridUser,
    authProvider: clerkUser ? 'clerk' : supabaseUser ? 'supabase' : null,
    signOut
  };
}

// Function to create/sync Clerk user with Supabase
export async function createClerkSupabaseUser(clerkUser: any) {
  try {
    const response = await fetch('/api/players/sync-clerk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clerk_user_id: clerkUser.id,
        email: clerkUser.emailAddresses[0]?.emailAddress,
        first_name: clerkUser.firstName,
        last_name: clerkUser.lastName,
        phone: clerkUser.phoneNumbers[0]?.phoneNumber
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to sync Clerk user');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error syncing Clerk user with Supabase:', error);
    throw error;
  }
}