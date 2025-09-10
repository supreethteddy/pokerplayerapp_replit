import { useUser, useAuth as useClerkAuthBase, useSignIn, useSignUp } from '@clerk/clerk-react';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { AuthUser } from './useAuth';

export function useClerkAuth() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const { signOut: clerkSignOut } = useClerkAuthBase();
  const { signIn: clerkSignIn } = useSignIn();
  const { signUp: clerkSignUpBase } = useSignUp();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Function to fetch or create player data after Clerk authentication
  const syncPlayerWithClerk = async (clerkUserId: string, email: string) => {
    try {
      console.log('🔗 [CLERK] Syncing player with Clerk ID:', clerkUserId);
      console.log('🔗 [CLERK] User phone numbers:', clerkUser?.phoneNumbers);
      console.log('🔗 [CLERK] Primary phone:', clerkUser?.primaryPhoneNumber);
      
      // Extract phone number with fallback logic
      const phoneNumber = clerkUser?.primaryPhoneNumber?.phoneNumber || 
                         clerkUser?.phoneNumbers?.[0]?.phoneNumber || 
                         '';
      
      console.log('🔗 [CLERK] Extracted phone number:', phoneNumber);
      
      const response = await apiRequest('/api/clerk/sync-player', {
        method: 'POST',
        body: {
          clerkUserId,
          email,
          firstName: clerkUser?.firstName || '',
          lastName: clerkUser?.lastName || '',
          phone: phoneNumber
        }
      });

      if (response.player) {
        const transformedUser: AuthUser = {
          id: response.player.id.toString(),
          email: response.player.email,
          firstName: response.player.firstName,
          lastName: response.player.lastName,
          phone: response.player.phone || '',
          kycStatus: response.player.kycStatus || 'pending',
          balance: response.player.balance || '0.00',
          totalDeposits: response.player.totalDeposits || '0.00',
          totalWithdrawals: response.player.totalWithdrawals || '0.00',
          totalWinnings: response.player.totalWinnings || '0.00',
          totalLosses: response.player.totalLosses || '0.00',
          gamesPlayed: response.player.gamesPlayed || 0,
          hoursPlayed: response.player.hoursPlayed || '0.00'
        };
        
        setUser(transformedUser);
        console.log('✅ [CLERK] Player synchronized:', transformedUser.id);
        return transformedUser;
      }
    } catch (error) {
      console.error('❌ [CLERK] Failed to sync player:', error);
      throw error;
    }
  };

  // Effect to handle Clerk user state changes
  useEffect(() => {
    if (!clerkLoaded) {
      return;
    }

    const handleClerkAuth = async () => {
      if (clerkUser) {
        try {
          const email = clerkUser.primaryEmailAddress?.emailAddress;
          if (email) {
            await syncPlayerWithClerk(clerkUser.id, email);
          }
        } catch (error) {
          console.error('Error syncing clerk user:', error);
          setUser(null);
        }
      } else {
        setUser(null);
        queryClient.clear();
      }
      setLoading(false);
    };

    handleClerkAuth();
  }, [clerkUser, clerkLoaded, queryClient]);

  // Clerk-based sign up
  const signUp = async (email: string, password: string, firstName: string, lastName: string, phone: string) => {
    try {
      if (!clerkSignUpBase) {
        throw new Error('Clerk sign up not available');
      }

      const signUpData: any = {
        emailAddress: email,
        password,
        firstName,
        lastName
      };

      // Add phone number if provided
      if (phone && phone.trim()) {
        signUpData.phoneNumber = phone;
      }

      const result = await clerkSignUpBase.create(signUpData);

      if (result.status === 'complete') {
        // After successful Clerk signup, create/sync the player record
        // Phone will be extracted from the created user object
        await syncPlayerWithClerk(result.createdUserId!, email);
        
        toast({
          title: "Account Created",
          description: "Please complete your KYC verification to access all features."
        });

        return { success: true, requiresKyc: true };
      }

      // Handle email verification if needed
      if (result.status === 'missing_requirements') {
        // Clerk will handle email verification UI
        return { success: true, requiresVerification: true };
      }

      return { success: false, error: 'Sign up incomplete' };
    } catch (error: any) {
      console.error('Clerk sign up error:', error);
      return { 
        success: false, 
        error: error.errors?.[0]?.message || error.message || 'Sign up failed' 
      };
    }
  };

  // Clerk-based sign in
  const signIn = async (email: string, password: string) => {
    try {
      if (!clerkSignIn) {
        throw new Error('Clerk sign in not available');
      }

      const result = await clerkSignIn.create({
        identifier: email,
        password
      });

      if (result.status === 'complete') {
        // User will be automatically synced via the useEffect
        return { success: true };
      }

      return { success: false, error: 'Sign in incomplete' };
    } catch (error: any) {
      console.error('Clerk sign in error:', error);
      return {
        success: false,
        error: error.errors?.[0]?.message || error.message || 'Sign in failed'
      };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await clerkSignOut();
      setUser(null);
      queryClient.clear();
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: 'Sign out failed' };
    }
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!user,
    clerkUser
  };
}