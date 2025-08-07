import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  kycStatus: string;
  balance: string;
  realBalance: string;
  creditBalance: string;
  creditLimit: string;
  creditApproved: boolean;
  totalBalance: string;
  totalDeposits: string;
  totalWithdrawals: string;
  totalWinnings: string;
  totalLosses: string;
  gamesPlayed: number;
  hoursPlayed: string;
  clerkUserId?: string;
}

export function useHybridAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const clerk = useClerk();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;

    // Force timeout after 8 seconds for reliable initialization
    const forceTimeout = setTimeout(() => {
      if (mounted) {
        console.log('🕐 [HYBRID AUTH] Force timeout - ending loading state');
        setLoading(false);
      }
    }, 8000);

    // Wait for Clerk to load before proceeding
    if (!clerkLoaded) {
      console.log('⏳ [HYBRID AUTH] Waiting for Clerk to load...');
      return;
    }

    console.log('🔄 [HYBRID AUTH] Clerk loaded, signed in:', isSignedIn);

    if (isSignedIn && clerkUser) {
      // User is signed in with Clerk - sync with Supabase
      syncWithSupabase(clerkUser);
    } else {
      // No Clerk user - check Supabase session
      checkSupabaseSession();
    }

    return () => {
      mounted = false;
      clearTimeout(forceTimeout);
    };

    async function syncWithSupabase(clerkUser: any) {
      console.log('🔗 [HYBRID AUTH] Syncing Clerk user with Supabase:', clerkUser.emailAddresses[0]?.emailAddress);
      
      try {
        const response = await fetch('/api/auth/clerk-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clerkUserId: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress,
            firstName: clerkUser.firstName,
            lastName: clerkUser.lastName,
            phone: clerkUser.phoneNumbers[0]?.phoneNumber,
            emailVerified: clerkUser.emailAddresses[0]?.verification.status === 'verified'
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const { player } = await response.json();
        
        // Enhanced user data with dual balance system
        const enhancedUserData: AuthUser = {
          ...player,
          realBalance: player.balance || '0.00',
          creditBalance: player.current_credit || '0.00',
          creditLimit: player.credit_limit || '0.00',
          creditApproved: player.credit_approved || false,
          totalBalance: (parseFloat(player.balance || '0.00') + parseFloat(player.current_credit || '0.00')).toFixed(2),
          clerkUserId: clerkUser.id
        };
        
        console.log('✅ [HYBRID AUTH] Clerk user synced:', enhancedUserData.email);
        setUser(enhancedUserData);
        setLoading(false);

        // Set session storage flag for loading screen
        sessionStorage.setItem('just_signed_in', 'true');
        
      } catch (error: any) {
        console.error('❌ [HYBRID AUTH] Clerk sync error:', error);
        toast({
          title: "Sync Error",
          description: "Failed to sync account data. Please try signing out and back in.",
          variant: "destructive",
        });
        setLoading(false);
      }
    }

    async function checkSupabaseSession() {
      console.log('🔍 [HYBRID AUTH] Checking Supabase session...');
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('📧 [HYBRID AUTH] Found Supabase session:', session.user.email);
          await fetchUserData(session.user.id);
        } else {
          console.log('🚫 [HYBRID AUTH] No active sessions found');
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ [HYBRID AUTH] Supabase session check error:', error);
        setLoading(false);
      }
    }
  }, [clerkLoaded, isSignedIn, clerkUser]);

  const fetchUserData = async (supabaseUserId: string) => {
    console.log('🔍 [HYBRID AUTH] Fetching user data for Supabase ID:', supabaseUserId);
    
    try {
      const response = await fetch(`/api/players/supabase/${supabaseUserId}`, {
        credentials: 'include',
        cache: 'no-cache',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('🚫 [HYBRID AUTH] Player not found - signing out');
          await supabase.auth.signOut();
          setUser(null);
          setLoading(false);
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const userData = await response.json();
      
      // Enhanced user data with dual balance system
      const enhancedUserData: AuthUser = {
        ...userData,
        realBalance: userData.balance || '0.00',
        creditBalance: userData.currentCredit || '0.00',
        creditLimit: userData.creditLimit || '0.00',
        creditApproved: userData.creditApproved || false,
        totalBalance: (parseFloat(userData.balance || '0.00') + parseFloat(userData.currentCredit || '0.00')).toFixed(2)
      };
      
      console.log('✅ [HYBRID AUTH] User data fetched:', enhancedUserData.email);
      setUser(enhancedUserData);
      setLoading(false);
      
    } catch (error: any) {
      console.error('❌ [HYBRID AUTH] Fetch error:', error);
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      
      // Sign out from both systems
      if (isSignedIn && clerk) {
        await clerk.signOut();
        console.log('✅ [HYBRID AUTH] Clerk signed out');
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      console.log('✅ [HYBRID AUTH] Supabase signed out');
      
      setUser(null);
      queryClient.clear();
      
      toast({
        title: "Signed Out",
        description: "You have been signed out successfully",
      });
    } catch (error: any) {
      console.error('❌ [HYBRID AUTH] Sign out error:', error);
      toast({
        title: "Sign Out Failed",
        description: error.message || "Failed to sign out",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    loading,
    isSignedIn,
    clerkUser,
    signOut,
  };
}