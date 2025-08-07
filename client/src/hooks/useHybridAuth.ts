import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useUltraFastAuth } from './useUltraFastAuth';
import { useState, useEffect } from 'react';

export interface HybridUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  kycStatus: string;
  balance: string;
  current_credit: string;
  credit_limit: string;
  credit_approved: boolean;
  clerkUserId?: string;
  authType: 'clerk' | 'supabase' | 'hybrid';
}

export function useHybridAuth() {
  // Clerk authentication state
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { signOut: clerkSignOut } = useClerkAuth();
  
  // Existing Supabase authentication state
  const { user: supabaseUser, loading: supabaseLoading, authChecked } = useUltraFastAuth();
  
  const [hybridUser, setHybridUser] = useState<HybridUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [syncInProgress, setSyncInProgress] = useState(false);

  // Sync Clerk user with backend when Clerk auth state changes
  useEffect(() => {
    async function syncClerkUser() {
      if (!clerkLoaded || !isSignedIn || !clerkUser || syncInProgress) {
        return;
      }

      setSyncInProgress(true);
      
      try {
        console.log('🔄 [HYBRID AUTH] Syncing Clerk user with backend...');
        
        const response = await fetch('/api/clerk/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clerkUserId: clerkUser.id,
            email: clerkUser.primaryEmailAddress?.emailAddress,
            firstName: clerkUser.firstName,
            lastName: clerkUser.lastName,
            phone: clerkUser.primaryPhoneNumber?.phoneNumber,
            emailVerified: clerkUser.primaryEmailAddress?.verification?.status === 'verified'
          })
        });

        if (response.ok) {
          const data = await response.json();
          setHybridUser({
            ...data.player,
            authType: 'clerk' as const
          });
          console.log('✅ [HYBRID AUTH] Clerk user synced successfully');
        } else {
          console.error('❌ [HYBRID AUTH] Failed to sync Clerk user');
        }
      } catch (error) {
        console.error('❌ [HYBRID AUTH] Sync error:', error);
      } finally {
        setSyncInProgress(false);
      }
    }

    syncClerkUser();
  }, [clerkUser, clerkLoaded, isSignedIn, syncInProgress]);

  // Use Supabase user if no Clerk user is available
  useEffect(() => {
    if (!isSignedIn && supabaseUser && !syncInProgress) {
      setHybridUser({
        ...supabaseUser,
        authType: 'supabase' as const
      });
      console.log('📱 [HYBRID AUTH] Using Supabase authentication');
    } else if (!isSignedIn && !supabaseUser && clerkLoaded && authChecked) {
      setHybridUser(null);
      console.log('🚫 [HYBRID AUTH] No authenticated user');
    }
  }, [isSignedIn, supabaseUser, clerkLoaded, authChecked, syncInProgress]);

  // Update loading state
  useEffect(() => {
    const loading = !clerkLoaded || supabaseLoading || syncInProgress;
    setIsLoading(loading);
  }, [clerkLoaded, supabaseLoading, syncInProgress]);

  const signOut = async () => {
    try {
      // Sign out from Clerk if signed in
      if (isSignedIn) {
        await clerkSignOut();
      }
      
      // Clear hybrid user state
      setHybridUser(null);
      
      // The existing Supabase signout will be handled by useUltraFastAuth
      console.log('✅ [HYBRID AUTH] Signed out successfully');
    } catch (error) {
      console.error('❌ [HYBRID AUTH] Sign out error:', error);
    }
  };

  return {
    user: hybridUser,
    loading: isLoading,
    authChecked: clerkLoaded && authChecked,
    isAuthenticated: !!hybridUser,
    isClerkUser: isSignedIn,
    isSupabaseUser: !isSignedIn && !!supabaseUser,
    signOut,
    clerkUser,
    supabaseUser
  };
}